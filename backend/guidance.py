"""No filenames, source excerpts, credentials or user prompts leave the service."""

import os
import re
import httpx
from .scanner import advice


def guidance(f, intent):
    _, explanation, fix, pattern = advice(f["engine"], f["rule"])
    fallback = {
        "Explain the risk": explanation,
        "Suggest a fix": fix + "\n\n" + pattern,
        "Verify remediation": "Apply the suggested change, then rescan the same project. Check that the rule no longer flags this location and that its engine completed. Review the change and test normal application behavior before marking it resolved.",
    }[intent]
    key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    if key and re.fullmatch(r"[a-zA-Z0-9.\-]{1,70}", model):
        try:
            # Rule IDs and categories come only from trusted installed engines.
            prompt = f"Provide concise defensive guidance for a developer. Do not describe attacks, exploit steps, or payloads. Use plain text, maximum 150 words. Do not claim the fix was verified. Engine: {f['engine']}. Rule: {f['rule']}. Severity: {f['severity']}. Task: {intent}. Curated context: {explanation} Safe remediation: {fix}"
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024},
                },
                timeout=15,
            )
            response.raise_for_status()
            candidate = response.json()["candidates"][0]
            if candidate.get("finishReason") == "STOP":
                answer = "\n".join(
                    p["text"]
                    for p in candidate["content"]["parts"]
                    if p.get("text") and not p.get("thought")
                ).strip()
                if answer:
                    return {
                        "answer": answer[:5000],
                        "provider": "Gemini · developer review required",
                    }
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
            pass
    return {
        "answer": fallback.strip(),
        "provider": "Local rule guidance · Gemini unavailable",
    }
