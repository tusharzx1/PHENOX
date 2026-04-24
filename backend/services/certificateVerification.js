const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const isSupportedCertificateMimeType = (mimeType = '') =>
  SUPPORTED_MIME_TYPES.has(String(mimeType).toLowerCase());

const buildGoldCertificatePrompt = () => `
You are an AI compliance officer for a gold tokenization platform.

Your task is to inspect a certificate document and determine whether it is trustworthy enough to be used as a pre-upload compliance document for a gold batch.

Rules:
- Be strict.
- Use only evidence visible in the provided file.
- Reject documents with obvious tampering signs, missing core fields, unreadable critical values, or suspicious formatting inconsistencies.
- Minor scan noise is acceptable if the important values are still legible.
- If the document is not clearly a gold assay or gold certificate, mark it invalid.

Return ONLY valid JSON with this exact shape:
{
  "isValid": true,
  "reason": "All checks passed.",
  "extractedData": {
    "serialNumber": "string or null",
    "grossWeight": "number or null",
    "purity": "string or null",
    "assayer": "string or null",
    "dateOfIssue": "string or null"
  }
}

Validation requirements:
- serialNumber must be present and legible.
- grossWeight must be present as grams when possible.
- purity must be present.
- assayer must be present.
- If date is visible, return ISO format YYYY-MM-DD when confidently inferable, otherwise null.
- If any critical field is missing in a suspicious or materially unreadable way, set isValid to false.
- When invalid, explain the main reason in "reason".
`.trim();

const extractJsonString = (rawText = '') => {
  const cleaned = String(rawText || '')
    .replace(/```json/gi, '```')
    .trim();

  if (!cleaned.startsWith('```')) return cleaned;

  return cleaned
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();
};

const normalizeString = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeAnalysis = (analysis, file) => {
  const extracted = analysis?.extractedData || {};
  const normalized = {
    isValid: Boolean(analysis?.isValid),
    reason: String(analysis?.reason || '').trim() || 'No reason provided.',
    extractedData: {
      serialNumber: normalizeString(extracted.serialNumber),
      grossWeight: normalizeNumber(extracted.grossWeight),
      purity: normalizeString(extracted.purity),
      assayer: normalizeString(extracted.assayer),
      dateOfIssue: normalizeString(extracted.dateOfIssue),
    },
    model: DEFAULT_GEMINI_MODEL,
    verifiedAt: new Date().toISOString(),
    fileName: String(file?.originalname || ''),
    mimeType: String(file?.mimetype || ''),
  };

  const requiredFields = [
    normalized.extractedData.serialNumber,
    normalized.extractedData.grossWeight,
    normalized.extractedData.purity,
    normalized.extractedData.assayer,
  ];

  if (normalized.isValid && requiredFields.some((value) => value === null)) {
    normalized.isValid = false;
    normalized.reason = 'Certificate analysis did not produce all required fields.';
  }

  if (normalized.isValid && normalized.reason.toLowerCase() !== 'all checks passed.') {
    normalized.reason = 'All checks passed.';
  }

  return normalized;
};

const verifyCertificateFile = async (file) => {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('GEMINI_API_KEY is not configured on the backend.');
    error.status = 503;
    throw error;
  }

  if (!file?.buffer?.length) {
    const error = new Error('No certificate file content was received.');
    error.status = 400;
    throw error;
  }

  if (!isSupportedCertificateMimeType(file.mimetype)) {
    const error = new Error('Unsupported certificate file type. Use PDF, PNG, JPG, or WEBP.');
    error.status = 400;
    throw error;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent([
    buildGoldCertificatePrompt(),
    {
      inlineData: {
        mimeType: file.mimetype,
        data: file.buffer.toString('base64'),
      },
    },
  ]);

  const response = await result.response;
  const text = extractJsonString(response.text());

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error('Gemini returned a non-JSON verification payload.');
    error.status = 502;
    throw error;
  }

  return normalizeAnalysis(parsed, file);
};

module.exports = {
  buildGoldCertificatePrompt,
  isSupportedCertificateMimeType,
  verifyCertificateFile,
};
