// src/controllers/api-documentation.controller.ts
import { Request, Response } from 'express';
import { Endpoint } from './api.documentatio.interfaces.';
import { getEndpoints } from './api.documentation.endpoints';

export class ApiDocumentationController {
  static generateDocumentation(req: Request, res: Response) {
    // Ekstrak parameter query untuk filtering
    const {
      method,
      category,
      tag,
      authentication,
      version,
      search
    } = req.query;

    // Fungsi filtering endpoints
    const filterEndpoints = (endpoints: Endpoint[]): Endpoint[] => {
      return endpoints.filter(endpoint => {
        // Filter berdasarkan metode
        if (method && endpoint.method !== method) return false;

        // Filter berdasarkan kategori
        if (category && endpoint.category !== category) return false;

        // Filter berdasarkan tag
        if (tag && !endpoint.tags?.includes(tag as string)) return false;

        // Filter berdasarkan authentication
        if (authentication && endpoint.authentication !== authentication) return false;

        // Filter berdasarkan versi
        if (version && endpoint.version !== version) return false;

        // Filter berdasarkan pencarian (case-insensitive)
        if (search) {
          const searchTerm = (search as string).toLowerCase();
          return (
            endpoint.path.toLowerCase().includes(searchTerm) ||
            endpoint.description.toLowerCase().includes(searchTerm) ||
            endpoint.tags?.some(t => t.toLowerCase().includes(searchTerm)) ||
            endpoint.category.toLowerCase().includes(searchTerm)
          );
        }

        return true;
      });
    };

    // Filter endpoints
    const filteredEndpoints = filterEndpoints(getEndpoints());

    // Gunakan template literal untuk membuat HTML dengan desain modern
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>📘 API Documentation</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Fira+Code:wght@300;400;600&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/Semua.min.css">
          <style>
            :root {
              --primary-color: #3498db;
              --secondary-color: #2ecc71;
              --background-color: #f4f7f6;
              --card-background: #ffffff;
              --text-primary: #2c3e50;
              --text-secondary: #7f8c8d;
              --border-color: #ecf0f1;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Inter', sans-serif;
              background-color: var(--background-color);
              color: var(--text-primary);
              line-height: 1.6;
              overflow-x: hidden;
            }

            .container {
              max-width: 1400px;
              margin: 0 auto;
              padding: 20px;
            }

            .header {
              background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
              color: white;
              text-align: center;
              padding: 40px 20px;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
              margin-bottom: 30px;
              position: relative;
              overflow: hidden;
            }

            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: rgba(255, 255, 255, 0.05);
              transform: rotate(-45deg);
            }

            .header h1 {
              font-size: 2.5rem;
              margin-bottom: 10px;
              font-weight: 600;
            }

            .filter-section {
              background-color: var(--card-background);
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 20px;
              box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }

            .filter-form {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              align-items: center;
              justify-content: space-between;
            }

            .filter-form > * {
              flex: 1;
              min-width: 200px;
              padding: 12px;
              border: 1px solid var(--border-color);
              border-radius: 8px;
              font-size: 16px;
              transition: Semua 0.3s ease;
            }

            .filter-form > *:focus {
              outline: none;
              border-color: var(--primary-color);
              box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
            }

            .api-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0 15px;
              background-color: var(--card-background);
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }

            .api-table th {
              background-color: var(--primary-color);
              color: white;
              padding: 15px;
              text-align: left;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
            }

            .api-table tr {
              transition: background-color 0.3s ease;
            }

            .api-table tr:hover {
              background-color: rgba(52, 152, 219, 0.05);
            }

            .api-table td {
              padding: 15px;
              border-bottom: 1px solid var(--border-color);
              font-family: 'Fira Code', monospace;
            }

            .method-tag {
              display: inline-block;
              padding: 5px 10px;
              border-radius: 4px;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 0.8em;
              margin-right: 10px;
              font-family: 'Fira Code', monospace;
            }

            .method-GET { background-color: #2ecc71; color: white; }
            .method-POST { background-color: #3498db; color: white; }
            .method-PUT { background-color: #f39c12; color: white; }
            .method-DELETE { background-color: #e74c3c; color: white; }
            .method-PATCH { background-color: #9b59b6; color: white; }

            .endpoint-details {
              font-size: 0.9em;
              color: var(--text-secondary);
            }

            .stats {
              background-color: var(--card-background);
              padding: 20px;
              border-radius: 12px;
              text-align: center;
              box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
              display: flex;
              justify-content: space-around;
              align-items: center;
              margin-top: 20px;
            }

            .stats-item {
              display: flex;
              flex-direction: column;
              align-items: center;
            }

            .stats-item i {
              font-size: 2rem;
              margin-bottom: 10px;
              color: var(--primary-color);
            }

            @media (max-width: 768px) {
              .filter-form > * {
                min-width: 100%;
              }

              .stats {
                flex-direction: column;
                gap: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 API Documentation</h1>
              <p>Comprehensive overview of Semua available API endpoints</p>
            </div>

            <div class="filter-section">
              <form class="filter-form" onsubmit="return false;">
                <input 
                  type="text" 
                  name="search" 
                  placeholder="🔍 Cari endpoints..." 
                  value="${search || ''}"
                  onchange="this.form.submit()"
                />
                
                <select name="method" onchange="this.form.submit()">
                  <option value="">Semua Methods</option>
                  <option value="GET" ${method === 'GET' ? 'selected' : ''}>GET</option>
                  <option value="POST" ${method === 'POST' ? 'selected' : ''}>POST</option>
                  <option value="PUT" ${method === 'PUT' ? 'selected' : ''}>PUT</option>
                  <option value="DELETE" ${method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                </select>
                
                <select name="category" onchange="this.form.submit()">
                  <option value="">Semua kategori</option>
                  ${[...new Set(getEndpoints().map(e => e.category))].map(cat => `
                    <option value="${cat}" ${category === cat ? 'selected' : ''}>${cat}</option>
                  `).join('')}
                </select>
                
                <select name="authentication" onchange="this.form.submit()">
                  <option value="">Semua Authentication</option>
                  <option value="public" ${authentication === 'public' ? 'selected' : ''}>Public</option>
                  <option value="user" ${authentication === 'user' ? 'selected' : ''}>User</option>
                  <option value="admin" ${authentication === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
              </form>
            </div>

            <table class="api-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Deskripsi</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                ${filteredEndpoints.map(endpoint => `
                  <tr>
                    <td>
                      <span class="method-tag method-${endpoint.method}">
                        ${endpoint.method}
                      </span>
                    </td>
                    <td>${endpoint.path}</td>
                    <td>${endpoint.description}</td>
                    <td class="endpoint-details">
                      <strong>Kategori:</strong> ${endpoint.category}<br>
                      <strong>Authentication:</strong> ${endpoint.authentication}<br>
                      <strong>Version:</strong> ${endpoint.version}<br>
                      <strong>Tags:</strong> ${endpoint.tags?.join(', ') || 'N/A'}<br>
                      <strong>Required Params:</strong> ${endpoint.requiredParams?.join(', ') || 'None'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="stats">
              <div class="stats-item">
                <i class="fas fa-link"></i>
                <strong>Total Endpoints</strong>
                <p>${filteredEndpoints.length}</p>
              </div>
              <div class="stats-item">
                <i class="fas fa-folder-open"></i>
                <strong>kategori</strong>
                <p>${[...new Set(getEndpoints().map(e => e.category))].length}</p>
              </div>
              <div class="stats-item">
                <i class="fas fa-code-branch"></i>
                <strong>API Versions</strong>
                <p>${[...new Set(getEndpoints().map(e => e.version))].join(', ')}</p>
              </div>
            </div>
          </div>

          <script>
            document.querySelectorSemua('.filter-form select, .filter-form input').forEach(element => {
              element.addEventListener('change', function() {
                this.closest('form').submit();
              });
            });
          </script>
        </body>
      </html>
    `;

    res.send(htmlContent);
  }
}