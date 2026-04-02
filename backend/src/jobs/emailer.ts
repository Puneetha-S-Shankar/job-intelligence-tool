import nodemailer from "nodemailer";
import { supabase } from "../lib/supabase";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface Alert {
  id: string;
  email: string;
  keywords: string;
  frequency: "daily" | "weekly";
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDailyDigest(
  toEmail: string,
  jobs: any[]
): Promise<void> {
  if (!jobs?.length) {
    console.log("[emailer] No jobs to send in digest");
    return;
  }

  try {
    const html = `
      <h2>Daily Placement Digest</h2>
      <p>Date: ${new Date().toLocaleDateString()}</p>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr>
          <th>Company</th>
          <th>Role</th>
          <th>Location</th>
          <th>Score</th>
        </tr>
        ${jobs
          .map(
            (job) => `
            <tr>
              <td>${escapeHtml(job.company)}</td>
              <td>${escapeHtml(job.title)}</td>
              <td>${escapeHtml(job.location)}</td>
              <td>${escapeHtml(String(job.conversion_score ?? ""))}</td>
            </tr>
          `
          )
          .join("")}
      </table>
    `;

    const from = process.env.EMAIL_USER;
    if (!from) {
      throw new Error("EMAIL_USER is not set");
    }

    await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Daily Placement Digest — ${jobs.length} jobs`,
      html,
    });

    console.log("[EMAIL] Digest sent successfully");
  } catch (error) {
    console.error("[EMAIL] Failed to send digest:", error);
    throw error;
  }
}

export interface JobAssignmentEmailJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  conversion_score?: number | null;
  source_url?: string | null;
}

/** Allow only http(s) URLs for href — avoids javascript: etc. */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Email officer when a job is assigned (Send to Officer). Rethrows on send failure so caller can log per-recipient. */
export async function sendJobAssignedToOfficerEmail(params: {
  toEmail: string;
  officerName: string;
  job: JobAssignmentEmailJob;
  note?: string | null;
}): Promise<void> {
  const from = process.env.EMAIL_USER;
  if (!from || !process.env.EMAIL_PASS) {
    console.warn("[emailer] EMAIL_USER / EMAIL_PASS not set — skipping assignment email");
    return;
  }

  const base = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
  const detailUrl = `${base}/jobs/${params.job.id}`;
  const listingHref = safeHttpUrl(params.job.source_url ?? undefined);

  const noteBlock =
    params.note?.trim() ?
      `<p><strong>Note from director:</strong><br/>${escapeHtml(params.note.trim()).replace(/\n/g, "<br/>")}</p>`
      : "";

  const originalLink =
    listingHref ?
      ` · <a href="${escapeHtml(listingHref)}">Original listing</a>`
      : "";

  const html = `
    <p>Hi ${escapeHtml(params.officerName)},</p>
    <p>A new job has been assigned to you in the Job Intelligence Tool. Please review it in the app or via the links below.</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
      <tr><th align="left">Company</th><td>${escapeHtml(params.job.company)}</td></tr>
      <tr><th align="left">Role</th><td>${escapeHtml(params.job.title)}</td></tr>
      <tr><th align="left">Location</th><td>${escapeHtml(params.job.location)}</td></tr>
      <tr><th align="left">Score</th><td>${escapeHtml(String(params.job.conversion_score ?? "—"))}</td></tr>
    </table>
    <p style="margin-top:16px;">
      <a href="${escapeHtml(detailUrl)}">Open job in JIT</a>${originalLink}
    </p>
    ${noteBlock}
    <p style="color:#666;font-size:12px;">This message was sent automatically when a director sent you this job.</p>
  `;

  try {
    await transporter.sendMail({
      from,
      to: params.toEmail,
      subject: `New job assignment: ${params.job.title} — ${params.job.company}`,
      html,
    });
    console.log(`[EMAIL] Assignment notification sent to ${params.toEmail}`);
  } catch (error) {
    console.error(`[EMAIL] Failed to send assignment email to ${params.toEmail}:`, error);
    throw error;
  }
}

export async function sendAlertEmails(frequency: "daily" | "weekly") {
  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("frequency", frequency)
    .eq("active", true);

  if (error || !alerts?.length) return;

  const since = new Date(
    Date.now() - (frequency === "daily" ? 1 : 7) * 24 * 60 * 60 * 1000
  ).toISOString();

  const from = process.env.EMAIL_USER;
  if (!from || !process.env.EMAIL_PASS) {
    console.warn("[emailer] EMAIL_USER / EMAIL_PASS not set — skipping alert emails");
    return;
  }

  for (const alert of alerts as Alert[]) {
    const keywords = alert.keywords.split(",").map((k: string) => k.trim());

    const { data: jobs } = await supabase
      .from("jobs")
      .select("title, company, location, source_url, posted_date")
      .gte("posted_date", since)
      .limit(10);

    const matched = (jobs ?? []).filter((job: { title: string }) =>
      keywords.some((kw: string) => job.title.toLowerCase().includes(kw.toLowerCase()))
    );

    if (!matched.length) continue;

    const rows = matched
      .map(
        (j: {
          title: string;
          company: string;
          location: string;
          source_url: string | null;
        }) =>
          `<li><a href="${escapeHtml(j.source_url ?? "#")}">${escapeHtml(j.title)}</a> — ${escapeHtml(j.company)}, ${escapeHtml(j.location)}</li>`
      )
      .join("");

    await transporter.sendMail({
      from,
      to: alert.email,
      subject: `Your ${frequency} job digest: ${matched.length} new matches`,
      html: `<h2>New jobs matching "${escapeHtml(alert.keywords)}"</h2><ul>${rows}</ul>`,
    });
  }
}
