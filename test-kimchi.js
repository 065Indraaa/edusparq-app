const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: "https://llm.kimchi.dev/openai/v1",
  apiKey: "castai_v1_66b4ef6f04a38a751451e084fb07168cd6a7d5b7f4f4e2ddc3958cca0a90bffb_bd4d64b1",
});

async function main() {
  try {
    console.log("Testing Kimchi Dev API with a different model (gpt-3.5-turbo)...");
    const completion = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Halo, ini tes koneksi." }],
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
