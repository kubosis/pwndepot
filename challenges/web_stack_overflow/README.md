# Web Stack Overflow

**Category:** Pwn  
**Language:** C  
**Difficulty:** Medium  

## Description
This challenge exposes a simple HTTP server written in C.
User input from an HTTP POST request is copied into a fixed size stack buffer
without bounds checking.

## Goal
Exploit the stack-based buffer overflow to redirect execution
and print the flag.

## Notes
- The flag is stored in an environment variable (`CTF_FLAG`)
- The service listens on port 8080
