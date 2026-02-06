package main

import (
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

// ProcessInfo holds detailed information about a process using a port
type ProcessInfo struct {
	Command  string `json:"command"`
	PID      string `json:"pid"`
	User     string `json:"user"`
	FD       string `json:"fd"`
	Type     string `json:"type"`
	Device   string `json:"device"`
	SizeOff  string `json:"sizeOff"`
	Node     string `json:"node"`
	Name     string `json:"name"`
	Port     string `json:"port"`
	Protocol string `json:"protocol"`
	State    string `json:"state"`
}

// KillResult holds the result of killing a process
type KillResult struct {
	PID     string `json:"pid"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SearchPort searches for processes using the specified port via lsof
func (a *App) SearchPort(port string) ([]ProcessInfo, error) {
	port = strings.TrimSpace(port)
	if port == "" {
		return nil, fmt.Errorf("port number cannot be empty")
	}

	// Validate port is a number
	if _, err := strconv.Atoi(port); err != nil {
		return nil, fmt.Errorf("invalid port number: %s", port)
	}

	// Run lsof command
	cmd := exec.Command("lsof", "-i", ":"+port, "-P", "-n")
	output, err := cmd.Output()
	if err != nil {
		// lsof returns exit code 1 when no processes found
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return []ProcessInfo{}, nil
		}
		return nil, fmt.Errorf("failed to execute lsof: %v", err)
	}

	return parseLsofOutput(string(output), port), nil
}

// SearchAllPorts searches all listening ports
func (a *App) SearchAllPorts() ([]ProcessInfo, error) {
	cmd := exec.Command("lsof", "-i", "-P", "-n", "-sTCP:LISTEN")
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return []ProcessInfo{}, nil
		}
		return nil, fmt.Errorf("failed to execute lsof: %v", err)
	}

	return parseLsofOutput(string(output), ""), nil
}

// KillProcess kills a process by PID
func (a *App) KillProcess(pid string) KillResult {
	pidInt, err := strconv.Atoi(strings.TrimSpace(pid))
	if err != nil {
		return KillResult{PID: pid, Success: false, Message: fmt.Sprintf("invalid PID: %s", pid)}
	}

	// First try SIGTERM (graceful)
	err = syscall.Kill(pidInt, syscall.SIGTERM)
	if err != nil {
		// If SIGTERM fails, try SIGKILL (force)
		err = syscall.Kill(pidInt, syscall.SIGKILL)
		if err != nil {
			return KillResult{PID: pid, Success: false, Message: fmt.Sprintf("failed to kill process %s: %v", pid, err)}
		}
	}

	return KillResult{PID: pid, Success: true, Message: fmt.Sprintf("process %s killed successfully", pid)}
}

// KillProcesses kills multiple processes by PID
func (a *App) KillProcesses(pids []string) []KillResult {
	results := make([]KillResult, 0, len(pids))

	// Deduplicate PIDs
	seen := make(map[string]bool)
	for _, pid := range pids {
		pid = strings.TrimSpace(pid)
		if seen[pid] {
			continue
		}
		seen[pid] = true
		results = append(results, a.KillProcess(pid))
	}

	return results
}

// parseLsofOutput parses the output of lsof command
func parseLsofOutput(output string, queryPort string) []ProcessInfo {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) <= 1 {
		return []ProcessInfo{}
	}

	var processes []ProcessInfo
	// Skip the header line
	for _, line := range lines[1:] {
		fields := strings.Fields(line)
		if len(fields) < 9 {
			continue
		}

		// Parse port and protocol from the Name field (last field)
		name := fields[len(fields)-1]
		port := ""
		protocol := ""
		state := ""

		// Check if there's a state field (e.g., "(LISTEN)", "(ESTABLISHED)")
		if len(fields) >= 10 {
			lastField := fields[len(fields)-1]
			if strings.HasPrefix(lastField, "(") && strings.HasSuffix(lastField, ")") {
				state = strings.Trim(lastField, "()")
				name = fields[len(fields)-2]
			}
		}

		// Extract port from name like "127.0.0.1:8080" or "*:8080"
		if idx := strings.LastIndex(name, ":"); idx >= 0 {
			port = name[idx+1:]
		}

		// Extract protocol from the node type
		nodeType := fields[7]
		if strings.Contains(strings.ToUpper(nodeType), "TCP") {
			protocol = "TCP"
		} else if strings.Contains(strings.ToUpper(nodeType), "UDP") {
			protocol = "UDP"
		} else {
			protocol = nodeType
		}

		info := ProcessInfo{
			Command:  fields[0],
			PID:      fields[1],
			User:     fields[2],
			FD:       fields[3],
			Type:     fields[4],
			Device:   fields[5],
			SizeOff:  fields[6],
			Node:     fields[7],
			Name:     name,
			Port:     port,
			Protocol: protocol,
			State:    state,
		}

		processes = append(processes, info)
	}

	return processes
}
