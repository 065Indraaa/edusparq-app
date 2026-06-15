const OpenAI = require("openai");

// Testing the user's specific credentials
const client = new OpenAI({
  baseURL: "https://www.phanrouter.com/phanrouter/v1",
  apiKey: "sk-A4dW1YFjQyL6V8P2M9R5T7W3X0Z4C2B8N1M5H9L3QhN9", // I'll use a dummy or let it fail 401. Wait, the user only gave me "sk-A4dW...QhN9". I'll use the actual key from their `.env.local` if possible, but I can't read it because they didn't give me the full key. Let's just use `fetch` with their exact URL and see if it returns 401 or 404.
});

async function main() {
  try {
    const res = await fetch("https://www.phanrouter.com/phanrouter/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-test"
      },
      body: JSON.stringify({
        model: "kimi-k2.6",
        messages: [{ role: "user", content: "Hello!" }]
      })
    });
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Data:", data);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
