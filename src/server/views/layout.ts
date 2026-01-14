export function Layout(
  title: string,
  content: string,
  username?: string
): string {
  const baseUrl = username ? `/${username}` : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      :root {
        --primary: #3b82f6;
        --primary-dark: #2563eb;
        --success: #22c55e;
        --danger: #ef4444;
        --warning: #f59e0b;
        --gray-50: #f9fafb;
        --gray-100: #f3f4f6;
        --gray-200: #e5e7eb;
        --gray-300: #d1d5db;
        --gray-400: #9ca3af;
        --gray-500: #6b7280;
        --gray-600: #4b5563;
        --gray-700: #374151;
        --gray-800: #1f2937;
        --gray-900: #111827;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        background: var(--gray-50);
        color: var(--gray-900);
        line-height: 1.6;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }

      header {
        background: white;
        border-bottom: 1px solid var(--gray-200);
        padding: 1rem 0;
        margin-bottom: 2rem;
      }

      nav {
        display: flex;
        align-items: center;
        gap: 2rem;
      }

      .logo {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--primary);
        text-decoration: none;
      }

      .nav-links {
        display: flex;
        gap: 1.5rem;
        list-style: none;
      }

      .nav-links a {
        color: var(--gray-600);
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
      }

      .nav-links a:hover {
        color: var(--primary);
      }

      .card {
        background: white;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .stat-card {
        text-align: center;
      }

      .stat-value {
        font-size: 2.5rem;
        font-weight: bold;
        color: var(--primary);
        margin: 0.5rem 0;
      }

      .stat-label {
        color: var(--gray-600);
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .stat-date {
        color: var(--gray-400);
        font-size: 0.75rem;
        margin-top: 0.25rem;
      }

      .btn {
        display: inline-block;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }

      .btn-primary {
        background: var(--primary);
        color: white;
      }

      .btn-primary:hover {
        background: var(--primary-dark);
      }

      .btn-secondary {
        background: var(--gray-200);
        color: var(--gray-700);
      }

      .btn-secondary:hover {
        background: var(--gray-300);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th {
        text-align: left;
        padding: 0.75rem;
        background: var(--gray-50);
        border-bottom: 2px solid var(--gray-200);
        font-weight: 600;
        color: var(--gray-700);
      }

      td {
        padding: 0.75rem;
        border-bottom: 1px solid var(--gray-200);
      }

      tr:hover {
        background: var(--gray-50);
      }

      .chart-container {
        position: relative;
        height: 300px;
        margin: 1rem 0;
      }

      .text-muted {
        color: var(--gray-500);
      }

      .text-sm {
        font-size: 0.875rem;
      }

      .text-center {
        text-align: center;
      }

      .mt-1 {
        margin-top: 0.5rem;
      }
      .mt-2 {
        margin-top: 1rem;
      }
      .mb-1 {
        margin-bottom: 0.5rem;
      }
      .mb-2 {
        margin-bottom: 1rem;
      }

      h1 {
        font-size: 2rem;
        margin-bottom: 1.5rem;
      }

      h2 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }

      h3 {
        font-size: 1.25rem;
        margin-bottom: 0.75rem;
      }

      .error-page {
        text-align: center;
        padding: 4rem 2rem;
      }

      .error-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      .error-title {
        font-size: 1.5rem;
        color: var(--gray-700);
        margin-bottom: 0.5rem;
      }

      .error-message {
        color: var(--gray-500);
        margin-bottom: 1.5rem;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }

      .alert {
        padding: 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
      }

      .alert-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
      }

      .alert-warning {
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
      }

      .alert-success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container">
        <nav>
          <a href="/" class="logo">Vitals</a>
          ${
            username
              ? `
          <ul class="nav-links">
            <li><a href="${baseUrl}">Dashboard</a></li>
            <li><a href="${baseUrl}/metrics">Metrics</a></li>
            <li><a href="${baseUrl}/workouts">Workouts</a></li>
            <li><a href="${baseUrl}/nutrition">Nutrition</a></li>
            <li><a href="${baseUrl}/clinical">Clinical</a></li>
            <li><a href="${baseUrl}/ecg">ECG</a></li>
            <li><a href="${baseUrl}/routes">Routes</a></li>
          </ul>
          <div style="margin-left: auto;">
            <a href="/" class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">Switch User</a>
          </div>
          `
              : ""
          }
        </nav>
      </div>
    </header>

    <main class="container">${content}</main>
  </body>
</html>`;
}

export function ErrorPage(
  title: string,
  message: string,
  backUrl: string,
  backLabel: string = "Go Back",
  username?: string
): string {
  const content = `
    <div class="error-page">
      <div class="error-icon">&#x26A0;</div>
      <h1 class="error-title">${title}</h1>
      <p class="error-message">${message}</p>
      <a href="${backUrl}" class="btn btn-primary">${backLabel}</a>
    </div>
  `;
  return Layout(`Vitals - ${title}`, content, username);
}

export function LayoutWithMap(
  title: string,
  content: string,
  username?: string
): string {
  const baseUrl = username ? `/${username}` : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      :root {
        --primary: #3b82f6;
        --primary-dark: #2563eb;
        --success: #22c55e;
        --danger: #ef4444;
        --warning: #f59e0b;
        --gray-50: #f9fafb;
        --gray-100: #f3f4f6;
        --gray-200: #e5e7eb;
        --gray-300: #d1d5db;
        --gray-400: #9ca3af;
        --gray-500: #6b7280;
        --gray-600: #4b5563;
        --gray-700: #374151;
        --gray-800: #1f2937;
        --gray-900: #111827;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        background: var(--gray-50);
        color: var(--gray-900);
        line-height: 1.6;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }

      header {
        background: white;
        border-bottom: 1px solid var(--gray-200);
        padding: 1rem 0;
        margin-bottom: 2rem;
      }

      nav {
        display: flex;
        align-items: center;
        gap: 2rem;
      }

      .logo {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--primary);
        text-decoration: none;
      }

      .nav-links {
        display: flex;
        gap: 1.5rem;
        list-style: none;
      }

      .nav-links a {
        color: var(--gray-600);
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
      }

      .nav-links a:hover {
        color: var(--primary);
      }

      .card {
        background: white;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        margin-bottom: 1.5rem;
      }

      .card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .stat-card {
        text-align: center;
      }

      .stat-value {
        font-size: 2.5rem;
        font-weight: bold;
        color: var(--primary);
        margin: 0.5rem 0;
      }

      .stat-label {
        color: var(--gray-600);
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .stat-date {
        color: var(--gray-400);
        font-size: 0.75rem;
        margin-top: 0.25rem;
      }

      .btn {
        display: inline-block;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }

      .btn-primary {
        background: var(--primary);
        color: white;
      }

      .btn-primary:hover {
        background: var(--primary-dark);
      }

      .btn-secondary {
        background: var(--gray-200);
        color: var(--gray-700);
      }

      .btn-secondary:hover {
        background: var(--gray-300);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th {
        text-align: left;
        padding: 0.75rem;
        background: var(--gray-50);
        border-bottom: 2px solid var(--gray-200);
        font-weight: 600;
        color: var(--gray-700);
      }

      td {
        padding: 0.75rem;
        border-bottom: 1px solid var(--gray-200);
      }

      tr:hover {
        background: var(--gray-50);
      }

      .chart-container {
        position: relative;
        height: 300px;
        margin: 1rem 0;
      }

      .text-muted {
        color: var(--gray-500);
      }

      .text-sm {
        font-size: 0.875rem;
      }

      .text-center {
        text-align: center;
      }

      .mt-1 {
        margin-top: 0.5rem;
      }
      .mt-2 {
        margin-top: 1rem;
      }
      .mb-1 {
        margin-bottom: 0.5rem;
      }
      .mb-2 {
        margin-bottom: 1rem;
      }

      h1 {
        font-size: 2rem;
        margin-bottom: 1.5rem;
      }

      h2 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
      }

      h3 {
        font-size: 1.25rem;
        margin-bottom: 0.75rem;
      }
    </style>
  </head>
  <body>
    <header>
      <div class="container">
        <nav>
          <a href="/" class="logo">Vitals</a>
          ${
            username
              ? `
          <ul class="nav-links">
            <li><a href="${baseUrl}">Dashboard</a></li>
            <li><a href="${baseUrl}/metrics">Metrics</a></li>
            <li><a href="${baseUrl}/workouts">Workouts</a></li>
            <li><a href="${baseUrl}/nutrition">Nutrition</a></li>
            <li><a href="${baseUrl}/clinical">Clinical</a></li>
            <li><a href="${baseUrl}/ecg">ECG</a></li>
            <li><a href="${baseUrl}/routes">Routes</a></li>
          </ul>
          <div style="margin-left: auto;">
            <a href="/" class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">Switch User</a>
          </div>
          `
              : ""
          }
        </nav>
      </div>
    </header>

    <main class="container">${content}</main>
  </body>
</html>`;
}
