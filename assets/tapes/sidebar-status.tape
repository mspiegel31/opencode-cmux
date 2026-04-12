Require opencode

Output assets/sidebar-status.gif

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

# Simple prompt — triggers Working → Conversation Complete
Type "what is 2+2?"
Sleep 500ms
Enter
Sleep 10s

# Prompt that triggers a permission — Working → Waiting → grant → Working
Type "create a file called /tmp/sidebar-demo.txt with the text hello world"
Sleep 500ms
Enter
Sleep 6s

# Grant the permission
Type "y"
Sleep 8s
