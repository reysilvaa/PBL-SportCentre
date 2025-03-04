import { Request, Response } from "express";

export const apiDocumentation = (req: Request, res: Response) => {
  res.send(`
    <html>
      <head>
        <title>API Documentation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            text-align: center;
            padding: 20px;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            display: inline-block;
            width: 90%;
            max-width: 1200px;
            overflow-x: auto;
          }
          h1 {
            color: #333;
            font-size: 28px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 18px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 15px;
            text-align: left;
          }
          th {
            background-color: #007bff;
            color: white;
          }
          .method {
            font-weight: bold;
            padding: 8px 12px;
            border-radius: 5px;
            color: white;
            display: inline-block;
          }
          .get { background-color: #28a745; }
          .post { background-color: #ffc107; color: black; }
          .put { background-color: #17a2b8; }
          .delete { background-color: #dc3545; }
          a {
            text-decoration: none;
            color: #007bff;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 API Documentation</h1>
          <table>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
            </tr>
            ${generateEndpointRow("GET", "/api/users")}
            ${generateEndpointRow("POST", "/api/users")}
            ${generateEndpointRow("PUT", "/api/users/:id")}
            ${generateEndpointRow("DELETE", "/api/users/:id")}
            ${generateEndpointRow("GET", "/api/branches")}
            ${generateEndpointRow("POST", "/api/branches")}
            ${generateEndpointRow("PUT", "/api/branches/:id")}
            ${generateEndpointRow("DELETE", "/api/branches/:id")}
            ${generateEndpointRow("GET", "/api/fields")}
            ${generateEndpointRow("POST", "/api/fields")}
            ${generateEndpointRow("PUT", "/api/fields/:id")}
            ${generateEndpointRow("DELETE", "/api/fields/:id")}
            ${generateEndpointRow("GET", "/api/bookings")}
            ${generateEndpointRow("POST", "/api/bookings")}
            ${generateEndpointRow("PUT", "/api/bookings/:id")}
            ${generateEndpointRow("DELETE", "/api/bookings/:id")}
            ${generateEndpointRow("GET", "/api/field-types")}
            ${generateEndpointRow("POST", "/api/field-types")}
            ${generateEndpointRow("PUT", "/api/field-types/:id")}
            ${generateEndpointRow("DELETE", "/api/field-types/:id")}
            ${generateEndpointRow("GET", "/api/payments")}
            ${generateEndpointRow("POST", "/api/payments")}
            ${generateEndpointRow("PUT", "/api/payments/:id")}
            ${generateEndpointRow("DELETE", "/api/payments/:id")}
            ${generateEndpointRow("GET", "/api/activity-logs")}
            ${generateEndpointRow("POST", "/api/activity-logs")}
            ${generateEndpointRow("PUT", "/api/activity-logs/:id")}
            ${generateEndpointRow("DELETE", "/api/activity-logs/:id")}
            ${generateEndpointRow("GET", "/api/field-reviews")}
            ${generateEndpointRow("POST", "/api/field-reviews")}
            ${generateEndpointRow("PUT", "/api/field-reviews/:id")}
            ${generateEndpointRow("DELETE", "/api/field-reviews/:id")}
            ${generateEndpointRow("GET", "/api/promotions")}
            ${generateEndpointRow("POST", "/api/promotions")}
            ${generateEndpointRow("PUT", "/api/promotions/:id")}
            ${generateEndpointRow("DELETE", "/api/promotions/:id")}
            ${generateEndpointRow("GET", "/api/promotion-usages")}
            ${generateEndpointRow("POST", "/api/promotion-usages")}
            ${generateEndpointRow("PUT", "/api/promotion-usages/:id")}
            ${generateEndpointRow("DELETE", "/api/promotion-usages/:id")}
          </table>
        </div>
      </body>
    </html>
  `);
};

const generateEndpointRow = (method: string, endpoint: string) => {
  const methodClass = method.toLowerCase();
  const link = method === "GET" ? `<a href="${endpoint}">${endpoint}</a>` : endpoint;
  return `<tr><td><span class="method ${methodClass}">${method}</span></td><td>${link}</td></tr>`;
};
