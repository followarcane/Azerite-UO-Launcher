# Azerite UO Launcher

A modern, customizable Ultima Online shard launcher built with Electron. Provides a professional launcher solution for your UO shard with auto-update functionality and a sleek user interface.

## Features

- 🎮 Automatic game download and installation
- 🔄 Auto-update system with version control
- 🛠️ Game file repair functionality
- 🎨 Three customizable themes:
  - Dark Fantasy (Default)
  - Ember
  - Azure
- 📊 Live server status and player count
- ⚙️ Advanced settings management
- 💾 Local configuration management
- 🖥️ Modern, responsive UI

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- For Windows: Windows 10/11
- Visual Studio Build Tools

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

## Building for Production

Create a Windows installer:
```bash
npm run build
```


The executable will be created in `out/make/squirrel.windows/x64`.
## Server Configuration
The server component requires the following structure:

server/
├── config.js # Server configuration
├── server.js # Main server file
└── full-client/ # Client files
└── info.json # Client information


### Server Configuration Example
```javascript
// server/config.js
module.exports = {
port: 3000,
clientVersion: "1.0.1",
patchNotes: "path/to/patchnotes",
fullClientUrl: "your-client-download-url",
serverStatus: {
endpoint: "your-server-status-endpoint"
}
}
```

## Client Configuration

The launcher stores configuration in the following locations:

### Config File
Location: `%APPDATA%/azerite-uo-launcher/config.json`
```json
{
"installPath": "path/to/installation",
"clientPath": "path/to/client",
"isInstalled": true
}
```

### Version File
Location: `%APPDATA%/azerite-uo-launcher/version.json`
```json
{
"version": "1.0.1",
"updateDate": "2024-01-09T16:40:35.224Z"
}
```

## Customization

### Themes
Modify theme colors in `src/renderer/styles.css`:
```css
:root {
--primary-color: #your-color;
--accent-color: #your-color;
/ ... other colors /
}
```

## Security Considerations

- Implement rate limiting for API endpoints
- Use HTTPS for all server communications
- Keep server endpoints behind a firewall
- Store sensitive information in environment variables

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact us through:
- Discord: followarcane
- Email: batuhanbiter@gmail.com

## Acknowledgments

Special thanks to all contributors who have helped make this launcher possible.

---

Remember to replace placeholder values (Discord link, email, etc.) with your actual information.