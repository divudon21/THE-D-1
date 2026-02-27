# IPTV Player

A modern, web-based IPTV player built with React, Vite, and Tailwind CSS.

## Features

- 📺 **M3U Playlist Support**: Parse and play standard M3U playlists.
- 🚀 **Fast & Responsive**: Built with Vite and optimized for performance.
- 📱 **PWA Support**: Installable as an app on mobile and desktop.
- 🔍 **Search & Filter**: Easily find channels by name or group.
- 🛠 **Proxy & Direct Modes**:
  - **Direct Mode**: Connects directly to streams (requires CORS extension or CORS-enabled streams).
  - **Proxy Mode**: Routes traffic through a backend proxy to bypass CORS (requires running the backend server).

## How to Run Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/iptv-player.git
    cd iptv-player
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    ```
    This starts both the frontend and the backend proxy server.

## Deployment

### Static Hosting (GitHub Pages, Vercel, Netlify)

If you deploy only the frontend (e.g., to GitHub Pages), the **Proxy Mode will not work** because the backend server (`server.ts`) cannot run on static hosting.

**To use on Static Hosting:**
1.  Uncheck the **"PROXY"** checkbox in the app.
2.  Install a **"Allow CORS"** browser extension (e.g., in Chrome, Edge, or Kiwi Browser on Android).
3.  This allows the browser to fetch streams directly from the source.

### Full Stack Hosting (Render, Railway, Heroku)

To use the **Proxy Mode** without browser extensions, you must deploy the full app (Frontend + Backend) to a service that supports Node.js.

## Technologies

-   [React](https://react.dev/)
-   [Vite](https://vitejs.dev/)
-   [Tailwind CSS](https://tailwindcss.com/)
-   [React Player](https://github.com/cookpete/react-player)
-   [Express](https://expressjs.com/) (for Proxy Server)

## License

MIT
