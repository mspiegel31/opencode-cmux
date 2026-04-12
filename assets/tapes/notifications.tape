Require opencode

Output assets/notifications.gif

Set Shell "bash"
Set FontSize 16
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set Padding 10

# Boot opencode with minimal config — no MCP servers
Hide
Type "source assets/tapes/demo-env.sh"
Enter
Sleep 500ms
Type "opencode"
Enter
Sleep 6s
Show

# Quick prompt — triggers idle notification when done
Type "what is 2+2?"
Sleep 500ms
Enter
Sleep 10s

# Prompt that needs permission — triggers permission notification
Type "create a file called /tmp/notification-demo.txt with hello"
Sleep 500ms
Enter
Sleep 6s

# Grant permission — triggers idle notification when done
Type "y"
Sleep 10s
