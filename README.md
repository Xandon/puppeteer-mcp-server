# Puppeteer MCP Server

A comprehensive Model Context Protocol (MCP) server for browser automation using Puppeteer, designed to work seamlessly with AI assistants like Claude.

## Overview

The Model Context Protocol (MCP) is an open standard introduced by Anthropic that standardizes how AI models connect to external data sources and tools. This server provides a secure, production-ready interface for browser automation tasks.

## Features

### 🔧 Core Tools
- **Navigation**: Navigate to URLs with security validation
- **Interaction**: Click, fill forms, and select dropdown options
- **Screenshots**: Capture full page or element-specific screenshots
- **JavaScript Execution**: Run sandboxed JavaScript in browser context

### 📊 Resources
- **Screenshot Management**: Access and manage captured screenshots
- **Console Logs**: Retrieve browser console logs and error messages

### 🛡️ Security Features
- URL validation and domain blocking
- Sandboxed JavaScript execution
- Rate limiting (100 requests per 15 minutes)
- Resource limits and timeout enforcement
- Chrome security sandbox with custom seccomp profile

### 🐳 Docker Support
- Production-ready Docker containers
- Non-root user execution
- Resource limits and health checks
- Chrome dependencies pre-installed

## Installation

### Local Development

1. Clone and install dependencies:
```bash
git clone <repository-url>
cd puppeteer-mcp-server
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

2. For production with monitoring:
```bash
docker-compose --profile monitoring up --build
```

## Available Tools

### puppeteer_navigate
Navigate to a URL and return page information.

**Parameters:**
- `url` (string, required): The URL to navigate to
- `timeout` (number, optional): Navigation timeout in milliseconds (default: 30000)

**Example:**
```json
{
  "url": "https://example.com",
  "timeout": 30000
}
```

### puppeteer_click
Click on an element specified by CSS selector.

**Parameters:**
- `selector` (string, required): CSS selector for the element
- `timeout` (number, optional): Timeout in milliseconds (default: 5000)

**Example:**
```json
{
  "selector": "button.submit",
  "timeout": 5000
}
```

### puppeteer_fill
Fill a form field with the specified value.

**Parameters:**
- `selector` (string, required): CSS selector for the form field
- `value` (string, required): Value to fill in the field
- `timeout` (number, optional): Timeout in milliseconds (default: 5000)

**Example:**
```json
{
  "selector": "input[name='email']",
  "value": "user@example.com",
  "timeout": 5000
}
```

### puppeteer_select
Select an option from a dropdown menu.

**Parameters:**
- `selector` (string, required): CSS selector for the select element
- `value` (string, required): Value of the option to select
- `timeout` (number, optional): Timeout in milliseconds (default: 5000)

**Example:**
```json
{
  "selector": "select[name='country']",
  "value": "US",
  "timeout": 5000
}
```

### puppeteer_screenshot
Take a screenshot of a webpage or specific element.

**Parameters:**
- `url` (string, required): The URL to screenshot
- `selector` (string, optional): CSS selector for specific element
- `width` (number, optional): Viewport width (default: 1280)
- `height` (number, optional): Viewport height (default: 720)
- `fullPage` (boolean, optional): Capture full page (default: false)

**Example:**
```json
{
  "url": "https://example.com",
  "selector": ".main-content",
  "width": 1920,
  "height": 1080,
  "fullPage": true
}
```

### puppeteer_evaluate
Execute JavaScript code in the browser context.

**Parameters:**
- `script` (string, required): JavaScript code to execute
- `timeout` (number, optional): Execution timeout in milliseconds (default: 30000)

**Example:**
```json
{
  "script": "document.title",
  "timeout": 30000
}
```

## Available Resources

### screenshot://list
Lists all saved screenshots with metadata.

### screenshot://file/{filename}
Retrieves a specific screenshot file.

### console://logs
Retrieves all captured console logs.

### console://logs/recent
Retrieves the 50 most recent console logs.

### console://logs/errors
Retrieves only error and warning console logs.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `LOG_LEVEL` | `info` | Logging level |
| `PUPPETEER_TIMEOUT` | `30000` | Default timeout for operations |
| `MAX_CONCURRENT_PAGES` | `5` | Maximum concurrent browser pages |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Maximum requests per window |
| `PUPPETEER_EXECUTABLE_PATH` | Auto-detected | Chrome executable path |

### Security Considerations

- **Domain Blocking**: Localhost and private IPs are blocked by default
- **Protocol Filtering**: Only HTTP/HTTPS URLs are allowed
- **Script Validation**: JavaScript execution is sandboxed and validated
- **Resource Limits**: Memory and CPU usage are monitored and limited
- **Rate Limiting**: Prevents abuse with configurable limits

## Usage with Claude Desktop

1. Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "node",
      "args": ["/path/to/puppeteer-mcp-server/build/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

2. Restart Claude Desktop to load the server.

3. Use browser automation tools in your conversations:
   - "Take a screenshot of https://example.com"
   - "Click the login button on the current page"
   - "Fill the search form with 'puppeteer tutorial'"

## Development

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run start`: Start the production server
- `npm run dev`: Start development server with hot reload
- `npm run inspector`: Start with MCP Inspector for debugging

### Project Structure

```
src/
├── config/           # Configuration files
├── tools/            # MCP tool implementations
├── browser/          # Browser management
├── resources/        # MCP resource implementations
├── types/            # TypeScript type definitions
├── server.ts         # Main server class
└── index.ts          # Entry point
```

## Troubleshooting

### Common Issues

1. **Chrome not found**: Ensure Chrome is installed or set `PUPPETEER_EXECUTABLE_PATH`
2. **Permission denied**: Run with proper user permissions or use Docker
3. **Memory issues**: Adjust Docker memory limits or reduce `MAX_CONCURRENT_PAGES`
4. **Network timeout**: Increase `PUPPETEER_TIMEOUT` for slow websites

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

### MCP Inspector

Debug MCP communication:
```bash
npm run inspector
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section
- Review logs in the `logs/` directory
- Open an issue on GitHub