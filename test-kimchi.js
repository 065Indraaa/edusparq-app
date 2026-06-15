const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: "https://zenmux.ai/api/v1",
  apiKey: "castai_v1_66b4ef6f04a38a751451e084fb07168cd6a7d5b7f4f4e2ddc3958cca0a90bffb_bd4d64b1",
});

async function main() {
  try {
    console.log("Testing Zenmux API connection...");
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2.7-code-free",
      messages: [{ role: "user", content: "Halo, ini tes dari server Node." }],
    });
    console.log("Response SUCCESS:");
    console.log(completion.choices[0].message);
  } catch (error) {
    console.error("Response FAILED:");
    console.error(error.message);
    if (error.response) {
      console.error(error.response.data);
    }
  }
}

main();
