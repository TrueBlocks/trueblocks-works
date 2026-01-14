package server

import (
	"fmt"
	"net"
	"net/http"
	"path/filepath"
)

type FileServer struct {
	pdfPath string
	port    int
	server  *http.Server
}

func New(pdfPath string) *FileServer {
	return &FileServer{
		pdfPath: pdfPath,
	}
}

func (s *FileServer) Start() (int, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, fmt.Errorf("failed to find available port: %w", err)
	}

	s.port = listener.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.HandleFunc("/pdf/", func(w http.ResponseWriter, r *http.Request) {
		filename := r.URL.Path[len("/pdf/"):]
		pdfFile := filepath.Join(s.pdfPath, filename)
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, pdfFile)
	})

	s.server = &http.Server{Handler: mux}

	go func() {
		_ = s.server.Serve(listener)
	}()

	return s.port, nil
}

func (s *FileServer) Port() int {
	return s.port
}
