# Chat assistant knowledge base

Everything in this folder is what the portfolio chat assistant knows about Shishir.
On each conversation it reads every `.md` file here (except this README) in full.

## Editing

- One topic per file. Plain markdown. Add files or folders freely; they are picked up automatically.
- Text inside `<!-- ... -->` comments is never shown to the assistant. The templates use
  comments for writing prompts: write your answer under each heading, then delete the
  comment or leave it, either way works.
- Headings with nothing written under them are harmless, but the assistant will say
  "I don't have that information" for anything not written down. It never guesses.
- Locally, edits take effect on the next chat message. In production, redeploy.

## Before you write

- Anything here can be repeated to **any visitor**, including competitors and current or
  past employers. Leave out client names, pricing, and internal figures unless they are
  already public or you have permission.
- Every page adds cost to each conversation (roughly $0.003 per page per conversation on
  Claude Opus 5.5). About a page per topic is plenty.

## What goes where

| File | Contents |
|---|---|
| `about-me.md` | Summary, availability, contact, experience, skills, credentials |
| `ai-transformation-hiddenbrains.md` | The story of building the AI function at HiddenBrains |
| `faq.md` | Questions recruiters and clients ask, answered in your words |
| `projects/*.md` | One file per delivered project |
| `ai-tools/*.md` | Custom GPTs, Claude skills, Delivery Cockpit, this chat assistant |
