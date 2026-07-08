package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"html/template"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

const (
	apiURL          = "https://store.rg-adguard.net/api/GetFiles"
	defaultStoreURL = "https://apps.microsoft.com/detail/9plm9xgg6vks?hl=zh-CN"
	defaultAddr     = ":8080"
)

//go:embed templates/index.html static/styles.css
var embeddedFiles embed.FS

type App struct {
	client   *http.Client
	template *template.Template
	config   FetchConfig
}

type FetchConfig struct {
	StoreURL     string
	QueryType    string
	Market       string
	Ring         string
	Language     string
	NameContains string
	Arch         string
	Extension    string
}

type StoreFile struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Expires string `json:"expires"`
	SHA1    string `json:"sha1"`
	Size    string `json:"size"`
	Version string `json:"version"`
	Arch    string `json:"arch"`
}

type PageData struct {
	File        *StoreFile
	Error       string
	GeneratedAt string
}

func main() {
	app, err := newApp()
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", app.handleHome)
	mux.HandleFunc("/api/latest", app.handleLatestAPI)
	mux.HandleFunc("/download", app.handleDownload)
	mux.HandleFunc("/proxy-download", app.handleProxyDownload)
	mux.HandleFunc("/healthz", app.handleHealthz)
	staticFiles, err := fs.Sub(embeddedFiles, "static")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticFiles))))

	addr := os.Getenv("PORT")
	if addr == "" {
		addr = defaultAddr
	} else if !strings.HasPrefix(addr, ":") {
		addr = ":" + addr
	}

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("Codex download page listening on http://localhost%s", addr)
	log.Fatal(server.ListenAndServe())
}

func newApp() (*App, error) {
	tpl, err := template.ParseFS(embeddedFiles, "templates/index.html")
	if err != nil {
		return nil, err
	}

	return &App{
		client: &http.Client{
			Timeout:   30 * time.Second,
			Transport: newHTTPTransport(),
		},
		config: FetchConfig{
			StoreURL:     envOrDefault("CODEX_STORE_URL", defaultStoreURL),
			QueryType:    envOrDefault("CODEX_QUERY_TYPE", "url"),
			Market:       envOrDefault("CODEX_MARKET", "US"),
			Ring:         envOrDefault("CODEX_RING", "RP"),
			Language:     envOrDefault("CODEX_LANGUAGE", "zh-CN"),
			NameContains: envOrDefault("CODEX_NAME_CONTAINS", "OpenAI.Codex"),
			Arch:         envOrDefault("CODEX_ARCH", "x64"),
			Extension:    envOrDefault("CODEX_EXTENSION", ".msix"),
		},
		template: tpl,
	}, nil
}

func newHTTPTransport() http.RoundTripper {
	resolver := &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialer := net.Dialer{Timeout: 5 * time.Second}
			return dialer.DialContext(ctx, network, "1.1.1.1:53")
		},
	}

	dialer := &net.Dialer{
		Timeout:   15 * time.Second,
		KeepAlive: 30 * time.Second,
		Resolver:  resolver,
	}

	return &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          50,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
}

func envOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func (app *App) handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	data := PageData{
		GeneratedAt: time.Now().Format("2006-01-02 15:04:05"),
	}
	file, err := app.fetchLatest(ctx)
	if err != nil {
		data.Error = err.Error()
	} else {
		data.File = file
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := app.template.Execute(w, data); err != nil {
		log.Printf("render home: %v", err)
	}
}

func (app *App) handleLatestAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	file, err := app.fetchLatest(ctx)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(file)
}

func (app *App) handleDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	file, err := app.fetchLatest(ctx)
	if err != nil {
		http.Error(w, "failed to get latest download link: "+err.Error(), http.StatusBadGateway)
		return
	}

	http.Redirect(w, r, file.URL, http.StatusFound)
}

func (app *App) handleProxyDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	file, err := app.fetchLatest(ctx)
	if err != nil {
		http.Error(w, "failed to get latest download link: "+err.Error(), http.StatusBadGateway)
		return
	}

	tracker := &trackingResponseWriter{ResponseWriter: w}
	if err := app.streamDownload(ctx, tracker, file); err != nil {
		log.Printf("stream download failed: %v", err)
		if !tracker.wroteHeader {
			http.Error(w, "failed to stream download: "+err.Error(), http.StatusBadGateway)
		}
	}
}

func (app *App) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok"))
}

func (app *App) streamDownload(ctx context.Context, w http.ResponseWriter, file *StoreFile) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, file.URL, nil)
	if err != nil {
		return err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/octet-stream,*/*")

	resp, err := app.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("download server returned HTTP %d: %s", resp.StatusCode, clip(string(body), 240))
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", file.Name))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	if length := resp.Header.Get("Content-Length"); length != "" {
		w.Header().Set("Content-Length", length)
	}

	_, err = io.Copy(w, resp.Body)
	return err
}

type trackingResponseWriter struct {
	http.ResponseWriter
	wroteHeader bool
}

func (w *trackingResponseWriter) WriteHeader(statusCode int) {
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *trackingResponseWriter) Write(data []byte) (int, error) {
	w.wroteHeader = true
	return w.ResponseWriter.Write(data)
}

func (app *App) fetchLatest(ctx context.Context) (*StoreFile, error) {
	pageHTML, err := app.fetchStoreHTML(ctx)
	if err != nil {
		return nil, err
	}

	files, err := parseStoreFiles(pageHTML)
	if err != nil {
		return nil, err
	}

	matches := filterFiles(files, app.config)
	if len(matches) == 0 {
		return nil, fmt.Errorf("no %s %s package matched in %d parsed files", app.config.Arch, app.config.Extension, len(files))
	}

	return &matches[0], nil
}

func (app *App) fetchStoreHTML(ctx context.Context) (string, error) {
	pageHTML, err := app.fetchStoreHTMLDirect(ctx)
	if err == nil {
		return pageHTML, nil
	}

	log.Printf("direct rg-adguard request failed, trying PowerShell fallback: %v", err)
	fallbackHTML, fallbackErr := app.fetchStoreHTMLWithPowerShell(ctx)
	if fallbackErr != nil {
		return "", fmt.Errorf("%v; PowerShell fallback failed: %w", err, fallbackErr)
	}
	return fallbackHTML, nil
}

func (app *App) fetchStoreHTMLDirect(ctx context.Context) (string, error) {
	form := url.Values{}
	form.Set("type", app.config.QueryType)
	form.Set("url", app.config.StoreURL)
	form.Set("gl", app.config.Market)
	form.Set("ring", app.config.Ring)
	form.Set("lang", app.config.Language)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}

	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Encoding", "identity")
	req.Header.Set("Accept-Language", app.config.Language+",zh;q=0.9,en;q=0.8")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Origin", "https://store.rg-adguard.net")
	req.Header.Set("Referer", "https://store.rg-adguard.net/")
	req.Header.Set("Sec-Ch-Ua", `"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"Windows"`)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36")

	resp, err := app.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("rg-adguard returned HTTP %d: %s", resp.StatusCode, clip(string(body), 240))
	}

	return string(body), nil
}

func (app *App) fetchStoreHTMLWithPowerShell(ctx context.Context) (string, error) {
	powerShellPath, err := findPowerShell()
	if err != nil {
		return "", err
	}

	script := `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$headers = @{
  'Accept' = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  'Accept-Encoding' = 'identity'
  'Accept-Language' = $env:CODEX_FETCH_LANGUAGE + ',zh;q=0.9,en;q=0.8'
  'Origin' = 'https://store.rg-adguard.net'
  'Referer' = 'https://store.rg-adguard.net/'
  'Sec-Ch-Ua' = '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"'
  'Sec-Ch-Ua-Mobile' = '?0'
  'Sec-Ch-Ua-Platform' = '"Windows"'
  'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
}
$body = @{
  type = $env:CODEX_FETCH_QUERY_TYPE
  url = $env:CODEX_FETCH_STORE_URL
  gl = $env:CODEX_FETCH_MARKET
  ring = $env:CODEX_FETCH_RING
  lang = $env:CODEX_FETCH_LANGUAGE
}
$response = Invoke-WebRequest -Uri 'https://store.rg-adguard.net/api/GetFiles' -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded' -Headers $headers -UseBasicParsing
[Console]::Out.Write($response.Content)
`

	cmd := exec.CommandContext(ctx, powerShellPath, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	cmd.Env = append(
		os.Environ(),
		"CODEX_FETCH_QUERY_TYPE="+app.config.QueryType,
		"CODEX_FETCH_STORE_URL="+app.config.StoreURL,
		"CODEX_FETCH_MARKET="+app.config.Market,
		"CODEX_FETCH_RING="+app.config.Ring,
		"CODEX_FETCH_LANGUAGE="+app.config.Language,
	)

	output, err := cmd.CombinedOutput()
	decoded := decodeCommandOutput(output)
	if err != nil {
		return "", fmt.Errorf("%w: %s", err, clip(decoded, 300))
	}
	return decoded, nil
}

func findPowerShell() (string, error) {
	for _, candidate := range []string{"pwsh", "powershell"} {
		path, err := exec.LookPath(candidate)
		if err == nil {
			return path, nil
		}
	}
	return "", errors.New("PowerShell was not found in PATH")
}

func decodeCommandOutput(output []byte) string {
	if len(output) >= 2 && output[0] == 0xff && output[1] == 0xfe {
		return decodeUTF16LE(output[2:])
	}
	if looksUTF16LE(output) {
		return decodeUTF16LE(output)
	}
	return string(output)
}

func looksUTF16LE(output []byte) bool {
	if len(output) < 8 {
		return false
	}

	zeroCount := 0
	for i := 1; i < len(output); i += 2 {
		if output[i] == 0 {
			zeroCount++
		}
	}
	return zeroCount > len(output)/4
}

func decodeUTF16LE(output []byte) string {
	if len(output)%2 == 1 {
		output = output[:len(output)-1]
	}

	values := make([]uint16, 0, len(output)/2)
	for i := 0; i < len(output); i += 2 {
		values = append(values, uint16(output[i])|uint16(output[i+1])<<8)
	}
	return string(utf16.Decode(values))
}

func parseStoreFiles(pageHTML string) ([]StoreFile, error) {
	if strings.Contains(pageHTML, "Just a moment") && strings.Contains(pageHTML, "challenge-platform") {
		return nil, errors.New("request was blocked by Cloudflare challenge")
	}

	rowPattern := regexp.MustCompile(`(?is)<tr[^>]*>\s*<td>\s*<a\s+href="([^"]+)"[^>]*>(.*?)</a>\s*</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>`)
	tagPattern := regexp.MustCompile(`(?is)<[^>]+>`)

	matches := rowPattern.FindAllStringSubmatch(pageHTML, -1)
	files := make([]StoreFile, 0, len(matches))
	for _, match := range matches {
		name := cleanCell(match[2], tagPattern)
		file := StoreFile{
			Name:    name,
			URL:     html.UnescapeString(match[1]),
			Expires: cleanCell(match[3], tagPattern),
			SHA1:    cleanCell(match[4], tagPattern),
			Size:    cleanCell(match[5], tagPattern),
			Version: parseVersion(name),
			Arch:    parseArch(name),
		}
		files = append(files, file)
	}

	return files, nil
}

func cleanCell(value string, tagPattern *regexp.Regexp) string {
	withoutTags := tagPattern.ReplaceAllString(value, "")
	return strings.Join(strings.Fields(html.UnescapeString(withoutTags)), " ")
}

func filterFiles(files []StoreFile, config FetchConfig) []StoreFile {
	needle := strings.ToLower(config.NameContains)
	extension := strings.ToLower(config.Extension)
	archMarker := "_" + strings.ToLower(config.Arch) + "_"

	matches := make([]StoreFile, 0, len(files))
	for _, file := range files {
		name := strings.ToLower(file.Name)
		if !strings.Contains(name, needle) {
			continue
		}
		if !strings.HasSuffix(name, extension) {
			continue
		}
		if !strings.Contains(name, archMarker) {
			continue
		}
		matches = append(matches, file)
	}

	sort.SliceStable(matches, func(i, j int) bool {
		versionCompare := compareVersionParts(versionParts(matches[i].Version), versionParts(matches[j].Version))
		if versionCompare != 0 {
			return versionCompare > 0
		}
		return parseSizeBytes(matches[i].Size) > parseSizeBytes(matches[j].Size)
	})

	return matches
}

func parseVersion(name string) string {
	match := regexp.MustCompile(`_([0-9]+(?:\.[0-9]+){1,})_`).FindStringSubmatch(name)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func parseArch(name string) string {
	match := regexp.MustCompile(`_([A-Za-z0-9]+)__`).FindStringSubmatch(name)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func versionParts(version string) []int {
	if version == "" {
		return nil
	}
	rawParts := strings.Split(version, ".")
	parts := make([]int, 0, len(rawParts))
	for _, part := range rawParts {
		value, err := strconv.Atoi(part)
		if err != nil {
			parts = append(parts, 0)
			continue
		}
		parts = append(parts, value)
	}
	return parts
}

func compareVersionParts(left, right []int) int {
	maxLength := len(left)
	if len(right) > maxLength {
		maxLength = len(right)
	}
	for i := 0; i < maxLength; i++ {
		leftValue, rightValue := 0, 0
		if i < len(left) {
			leftValue = left[i]
		}
		if i < len(right) {
			rightValue = right[i]
		}
		if leftValue > rightValue {
			return 1
		}
		if leftValue < rightValue {
			return -1
		}
	}
	return 0
}

func parseSizeBytes(size string) float64 {
	pattern := regexp.MustCompile(`(?i)([0-9]+(?:\.[0-9]+)?)\s*([KMGT]?B)`)
	match := pattern.FindStringSubmatch(size)
	if len(match) < 3 {
		return 0
	}

	value, err := strconv.ParseFloat(match[1], 64)
	if err != nil {
		return 0
	}

	scale := map[string]int{
		"KB": 1,
		"MB": 2,
		"GB": 3,
		"TB": 4,
	}
	unit := strings.ToUpper(match[2])
	power := scale[unit]
	for i := 0; i < power; i++ {
		value *= 1024
	}
	return value
}

func clip(value string, limit int) string {
	value = strings.Join(strings.Fields(value), " ")
	if len(value) <= limit {
		return value
	}
	return value[:limit] + "..."
}
