import crypto from "node:crypto";

const TEST_COVERS = [
  ["b01d2a22-c3ae-4a5f-8950-aacf07e37697", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-hindi/b01d2a22-c3ae-4a5f-8950-aacf07e37697/aavilayile-sooryodayam.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["c162ff03-cd91-4493-97e2-796e82a4271b", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-hindi/c162ff03-cd91-4493-97e2-796e82a4271b/abhijata.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["f0423d86-7a69-47ab-a349-8025bb821459", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/library-import-20261008/mrityunjay.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["40891a24-7093-4c2e-bd49-d057ef5aad10", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-hindi/40891a24-7093-4c2e-bd49-d057ef5aad10/aakasamlo-sagam.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["25da26d1-60a8-4dcd-850a-45e5057996e2", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-hindi/25da26d1-60a8-4dcd-850a-45e5057996e2/aagamana.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["54da75a5-5436-4584-a542-9df105f292a0", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-hindi-batch2/54da75a5-5436-4584-a542-9df105f292a0/agneyam.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["2a04ede6-feff-42ba-b14e-c11432de2a0b", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-hindi/2a04ede6-feff-42ba-b14e-c11432de2a0b/abachurina-post-office.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["064fbf2a-95c0-43e5-a539-e069a70f03fc", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-new/hi/064fbf2a-95c0-43e5-a539-e069a70f03fc/ame-badha.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["5702a496-489c-43bb-8266-bc9683c4f0ad", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010/5702a496-489c-43bb-8266-bc9683c4f0ad/101-essays-that-will-change-the-way-you-think.png?width=720&height=1080&resize=cover&quality=78&format=webp"],
  ["5d4f1dfe-edc5-4caa-b3d5-7afdeef61101", "https://pbkfewrtdgiagytmcigb.supabase.co/storage/v1/render/image/public/book-covers/chatgpt-20261010-new/en/5d4f1dfe-edc5-4caa-b3d5-7afdeef61101/365-days-with-self-discipline.png?width=720&height=1080&resize=cover&quality=78&format=webp"]
];

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => crypto.createHmac("sha256", key).update(value).digest(encoding);
const encodePath = (value) => value.split("/").map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");

async function putR2({ key, body, contentType }) {
  const endpoint = process.env.R2_ENDPOINT?.replace(/\/$/, "");
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKey || !secretKey) throw new Error("Missing R2 environment variables");

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const host = new URL(endpoint).host;
  const canonicalUri = `/${encodePath(bucket)}/${encodePath(key)}`;
  const cacheControl = "public, max-age=31536000, immutable";
  const canonicalHeaders = `cache-control:${cacheControl}\ncontent-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const kDate = hmac(Buffer.from(`AWS4${secretKey}`, "utf8"), dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${endpoint}${canonicalUri}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Cache-Control": cacheControl,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate
    },
    body
  });
  if (!response.ok) throw new Error(`R2 PUT failed ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

export default async function handler(req, res) {
  const url = new URL(req.url, "https://booknomics.local");
  if (url.searchParams.get("token") !== process.env.R2_MIGRATION_TOKEN) return res.status(401).json({ ok: false });

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicBase) return res.status(500).json({ ok: false, error: "Missing R2_PUBLIC_URL" });

  const results = [];
  for (const [id, sourceUrl] of TEST_COVERS) {
    try {
      const source = await fetch(sourceUrl);
      if (!source.ok) throw new Error(`Source fetch failed ${source.status}`);
      const body = Buffer.from(await source.arrayBuffer());
      const key = `r2-smoke-test/${id}.webp`;
      await putR2({ key, body, contentType: "image/webp" });
      const publicUrl = `${publicBase}/${key}`;
      const verify = await fetch(publicUrl, { method: "HEAD" });
      results.push({ id, bytes: body.length, publicUrl, verified: verify.ok, status: verify.status });
    } catch (error) {
      results.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const success = results.filter((item) => item.verified).length;
  return res.status(success === TEST_COVERS.length ? 200 : 207).json({ ok: success === TEST_COVERS.length, success, total: TEST_COVERS.length, results });
}
