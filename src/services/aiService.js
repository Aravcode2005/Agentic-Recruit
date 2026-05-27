
const {default:OpenAI}= require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function parseCandidateReply(
  text
) {
  const response =
    await client.chat.completions.create({
      model:"gpt-3.5-turbo",
      messages: [
        {
          role: 'system',
          content: `
Extract candidate information from the email.

Return ONLY valid JSON.

Schema:
{
  "full_name": "",
  "location": "",
  "visa_status": "",
  "arrival_date": "",
  "marketing_services": ""
}

Rules:
- If information is missing, use null
- Do not explain anything
- Do not add markdown
- Do not use triple backticks
- Output raw JSON only
- Normalize visa statuses when possible
- Convert variations like:
  "stem opt" -> "STEM-OPT"
  "f1 opt" -> "F1-OPT"
  "initial opt" -> "INITIAL-OPT"
  "cpt" -> "CPT"
`
        },

        {
          role: 'user',
          content: text
        }
      ]
    });

  const raw =
    response.choices[0].message.content;

  const cleaned = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(cleaned);
}

module.exports =
  parseCandidateReply;