import { Elysia } from "elysia";
import { getDatabase } from "../../db/client";
import { getAllUsers } from "../../db/queries";
import { Layout, ErrorPage } from "../views/layout";

const PAGE_SIZE = 50;

function paginationControls(
  basePath: string,
  currentPage: number,
  totalPages: number,
  totalRecords: number,
  filterType?: string
): string {
  if (totalPages <= 1) return "";

  const pages: string[] = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  const typeParam = filterType ? `&type=${filterType}` : "";

  if (currentPage > 1) {
    pages.push(
      `<a href="${basePath}?page=${currentPage - 1}${typeParam}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">← Prev</a>`
    );
  }

  if (start > 1) {
    pages.push(
      `<a href="${basePath}?page=1${typeParam}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">1</a>`
    );
    if (start > 2) pages.push(`<span style="padding: 0 0.5rem;">...</span>`);
  }

  for (let i = start; i <= end; i++) {
    if (i === currentPage) {
      pages.push(
        `<span class="btn btn-primary" style="padding: 0.25rem 0.5rem;">${i}</span>`
      );
    } else {
      pages.push(
        `<a href="${basePath}?page=${i}${typeParam}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">${i}</a>`
      );
    }
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push(`<span style="padding: 0 0.5rem;">...</span>`);
    pages.push(
      `<a href="${basePath}?page=${totalPages}${typeParam}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">${totalPages}</a>`
    );
  }

  if (currentPage < totalPages) {
    pages.push(
      `<a href="${basePath}?page=${currentPage + 1}${typeParam}" class="btn btn-secondary" style="padding: 0.25rem 0.5rem;">Next →</a>`
    );
  }

  return `
    <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 1rem;">
      ${pages.join("")}
      <span class="text-muted text-sm" style="margin-left: 1rem;">
        ${totalRecords.toLocaleString()} total
      </span>
    </div>
  `;
}

export default new Elysia()
  .get("/:username/clinical", ({ params, query }) => {
    const username = params.username;
    const filterType = query.type as string | undefined;
    const page = Math.max(1, parseInt((query.page as string) || "1", 10));
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    // Get resource type counts
    const typeCounts = db
      .query<{ resource_type: string; count: number }>(
        `SELECT resource_type, COUNT(*) as count
         FROM clinical_records
         WHERE user_id = ?
         GROUP BY resource_type
         ORDER BY count DESC`
      )
      .all(user.id);

    const totalAllRecords = typeCounts.reduce((sum, t) => sum + t.count, 0);

    // Get count for current filter
    let countQuery = `SELECT COUNT(*) as count FROM clinical_records WHERE user_id = ?`;
    const countParams: any[] = [user.id];
    if (filterType) {
      countQuery += ` AND resource_type = ?`;
      countParams.push(filterType);
    }
    const countResult = db.query<{ count: number }>(countQuery).get(...countParams);
    const totalRecords = countResult?.count || 0;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
    const offset = (page - 1) * PAGE_SIZE;

    // Get records with optional type filter
    let recordsQuery = `
      SELECT id, resource_type, resource_id, recorded_date, display_name,
             code, code_system, value_text, value_quantity, value_unit
      FROM clinical_records
      WHERE user_id = ?
    `;
    const queryParams: any[] = [user.id];

    if (filterType) {
      recordsQuery += ` AND resource_type = ?`;
      queryParams.push(filterType);
    }

    recordsQuery += ` ORDER BY recorded_date DESC LIMIT ? OFFSET ?`;
    queryParams.push(PAGE_SIZE, offset);

    const records = db
      .query<{
        id: number;
        resource_type: string;
        resource_id: string;
        recorded_date: string;
        display_name: string;
        code: string;
        code_system: string;
        value_text: string;
        value_quantity: number;
        value_unit: string;
      }>(recordsQuery)
      .all(...queryParams);

    const content = `
      <h1>Clinical Records</h1>

      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Total Records</div>
          <div class="stat-value" style="font-size: 2rem;">
            ${totalAllRecords.toLocaleString()}
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Resource Types</div>
          <div class="stat-value" style="font-size: 2rem;">
            ${typeCounts.length}
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Filter by Type</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
          <a href="/${username}/clinical"
             class="btn ${!filterType ? "btn-primary" : "btn-secondary"}"
             style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
            All (${totalAllRecords})
          </a>
          ${typeCounts
            .map(
              (t) => `
            <a href="/${username}/clinical?type=${t.resource_type}"
               class="btn ${filterType === t.resource_type ? "btn-primary" : "btn-secondary"}"
               style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
              ${t.resource_type} (${t.count})
            </a>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="card">
        <h2>Records ${filterType ? `(${filterType})` : ""}</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Name</th>
              <th>Code</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${records
              .map((record) => {
                const dateStr = record.recorded_date
                  ? new Date(record.recorded_date).toLocaleDateString()
                  : "N/A";
                const value = record.value_quantity !== null
                  ? `${record.value_quantity} ${record.value_unit || ""}`
                  : record.value_text || "-";
                const codeDisplay = record.code
                  ? `<span class="text-muted text-sm">${record.code}</span>`
                  : "-";
                return `
                <tr>
                  <td class="text-sm">${dateStr}</td>
                  <td>
                    <span style="background: var(--primary); color: white; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                      ${record.resource_type}
                    </span>
                  </td>
                  <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                    ${record.display_name || "-"}
                  </td>
                  <td>${codeDisplay}</td>
                  <td class="text-sm">${value}</td>
                  <td>
                    <a href="/${username}/clinical/${record.id}"
                       class="btn btn-secondary"
                       style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                      View
                    </a>
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
        ${paginationControls(`/${username}/clinical`, page, totalPages, totalRecords, filterType)}
      </div>
    `;

    return Layout("Vitals - Clinical Records", content, username);
  })
  .get("/:username/clinical/:id", ({ params }) => {
    const username = params.username;
    const recordId = parseInt(params.id);
    const db = getDatabase();
    const users = getAllUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return Response.redirect("/");
    }

    const record = db
      .query<{
        id: number;
        resource_type: string;
        resource_id: string;
        recorded_date: string;
        display_name: string;
        code: string;
        code_system: string;
        value_text: string;
        value_quantity: number;
        value_unit: string;
        raw_json: string;
        file_path: string;
      }>(
        `SELECT * FROM clinical_records WHERE id = ? AND user_id = ?`
      )
      .get(recordId, user.id);

    if (!record) {
      return ErrorPage(
        "Record Not Found",
        `Clinical record #${recordId} was not found or you don't have access to it.`,
        `/${username}/clinical`,
        "Back to Clinical Records",
        username
      );
    }

    // Format JSON for display
    let formattedJson = "";
    try {
      const parsed = JSON.parse(record.raw_json);
      formattedJson = JSON.stringify(parsed, null, 2);
    } catch {
      formattedJson = record.raw_json || "No data available";
    }

    const dateStr = record.recorded_date
      ? new Date(record.recorded_date).toLocaleString()
      : "N/A";

    const content = `
      <div style="margin-bottom: 1rem;">
        <a href="/${username}/clinical" class="btn btn-secondary">&larr; Back to Clinical Records</a>
      </div>

      <h1>${record.display_name || record.resource_type}</h1>

      <div class="card-grid">
        <div class="card stat-card">
          <div class="stat-label">Resource Type</div>
          <div class="stat-value" style="font-size: 1.25rem;">
            ${record.resource_type}
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-label">Date</div>
          <div class="stat-value" style="font-size: 1rem;">
            ${dateStr}
          </div>
        </div>

        ${record.code ? `
        <div class="card stat-card">
          <div class="stat-label">Code</div>
          <div class="stat-value" style="font-size: 1rem;">
            ${record.code}
          </div>
          <div class="stat-date">${record.code_system || ""}</div>
        </div>
        ` : ""}

        ${record.value_quantity !== null ? `
        <div class="card stat-card">
          <div class="stat-label">Value</div>
          <div class="stat-value" style="font-size: 1.5rem;">
            ${record.value_quantity}
          </div>
          <div class="stat-date">${record.value_unit || ""}</div>
        </div>
        ` : ""}

        ${record.value_text ? `
        <div class="card stat-card">
          <div class="stat-label">Status</div>
          <div class="stat-value" style="font-size: 1rem;">
            ${record.value_text}
          </div>
        </div>
        ` : ""}
      </div>

      <div class="card">
        <h2>FHIR Resource</h2>
        <pre style="background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.875rem; line-height: 1.5;"><code>${escapeHtml(formattedJson)}</code></pre>
      </div>

      <div class="card">
        <h3>Resource ID</h3>
        <p class="text-muted text-sm" style="word-break: break-all;">${record.resource_id}</p>
      </div>
    `;

    return Layout(`Vitals - ${record.display_name || record.resource_type}`, content, username);
  });

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
