
export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "На сервере ещё не настроен ключ Claude API." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages = messages
      .filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "Напиши сообщение." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: "You are AXIOM AI, a helpful, clear, and respectful general-purpose assistant. Reply in the user's language.",
        messages: safeMessages,
      }),
    });

    const result = await upstream.json();
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: result?.error?.message || "Ошибка Claude API." }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const reply = (result.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Не удалось обработать запрос." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
