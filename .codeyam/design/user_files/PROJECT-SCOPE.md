# Project Scope

## Working Concept

**A conversational AI tool that helps people turn vague ideas and problems into clear, structured, actionable plans.**

The user starts with an idea, question, problem, or goal that feels too abstract to know where to begin.

Instead of immediately generating an answer, the AI helps the user **deconstruct the problem**, asks targeted questions, performs relevant research, and continuously turns the conversation into a **visual map of the problem space**.

The goal is not to tell the user what to do.

The goal is to help them **think more clearly about what they could do next.**

---

## The Problem

People often have ideas they cannot easily translate into action.

They might say:

- "I want to build an app, but I don't know where to start."
- "I have an idea for a business."
- "I want to improve how my team plans events."
- "I want to create something for my kids."
- "I think there is a better way to solve this problem."

Existing AI tools are very good at generating answers, ideas, and plans.

But generating more ideas is not always the problem.

The harder problem is **figuring out what the actual problem is, what assumptions matter, what options exist, and what should happen next.**

---

## The User

The product should be useful to **any curious person who has an idea, problem, or goal they want to think through.**

For the hackathon demo, we will focus on:

> **A person who has an idea for a startup or product but doesn't know where to begin.**

The startup example is a compelling demonstration of the broader capability, rather than a limitation of the product.

---

## Core User Experience

### 1. Start with an idea

The user enters something vague.

Example:

> "I want to build an educational game for children, but I don't know what it should be."

No structured input is required.

---

### 2. The AI deconstructs the idea

Instead of immediately proposing a solution, the AI identifies important unknowns and asks targeted questions.

For example:

> Who is this actually for?

> What problem are you trying to solve for them?

> What are they doing today?

> What constraints do you have?

> What would make this solution meaningfully different?

The AI should prioritize **high-value questions** rather than conducting a generic questionnaire.

---

### 3. Build a visual map

As the conversation develops, the system creates and updates a visual representation of the user's thinking.

The map can contain nodes such as:

- Problem
- Users
- Goals
- Constraints
- Assumptions
- Existing solutions
- Opportunities
- Possible approaches
- Open questions
- Next steps

The map should evolve as the user answers questions.

The conversation and the map are two views of the same thinking process.

---

### 4. Research the problem space

When useful, the AI can perform research to ground the map in reality.

For example:

> "Before we decide what to build, let's look at what already exists."

The AI may identify:

- Existing products
- Competitors
- Relevant examples
- Existing approaches
- Market/contextual information
- Potential gaps

Research should be connected to the map rather than appearing as an unrelated list of search results.

---

### 5. Explore and iterate

The user can challenge or modify the thinking.

For example:

> "What if the user isn't a child but a teacher?"

The AI updates the relevant parts of the map and explains what changed.

The user should be able to explore different branches without losing the original idea.

---

### 6. End with a clear starting point

Once enough of the problem has been explored, the system produces an actionable starting plan.

For example:

**Where to start**

1. Interview 3 parents.
2. Research existing educational games.
3. Identify the specific learning problem.
4. Create one simple gameplay concept.
5. Test it with one child.

The important transformation is:

**Abstract idea → structured understanding → possible directions → concrete next steps**

---

# MVP

With only three days to build, the MVP will focus on one excellent loop:

> **Chat → Deconstruct → Research → Visualize → Act**

### Must Have

- Conversational AI interface
- AI-driven questioning/deconstruction
- Persistent structured representation of the user's idea
- Interactive visual map
- AI-assisted research
- Ability to update the map as the conversation evolves
- Clear next-step/action plan
- MCP integration

### Nice to Have

- Zooming and panning
- Dragging nodes
- Expand/collapse branches
- Click a node to ask questions about it
- Multiple solution branches
- Ability to revisit previous decisions

### Explicitly Out of Scope

To protect the three-day build:

- Full project management
- Team collaboration
- Authentication/accounts
- Complex project/task tracking
- Full prototype generation
- Automatic app generation
- Advanced visual editing
- Multiple specialized agents
- Long-term memory across projects
- Production-grade research infrastructure
- Building the user's final product

These can be future extensions.

---

# The Demo

The demo should tell a simple story.

### Opening

> "I have an idea for an educational game, but I have no idea where to start."

The user enters the idea.

### The AI responds

Rather than giving them a giant answer:

> "Let's break this down. I see a few things we don't know yet."

The AI asks a small number of meaningful questions.

### The map appears

The audience sees the idea transform into a structured visual model.

New information creates new branches.

### Research

The AI discovers relevant existing products/examples and adds them to the map.

### The user changes direction

> "Actually, what if this was designed for teachers instead?"

The map changes.

### Final moment

The AI presents:

> **Here's what we've learned.**
>
> **Here are the three strongest directions.**
>
> **And here's where I'd start tomorrow.**

The audience sees that the user has gone from:

**"I have an idea."**

to:

**"I understand the problem, I see my options, and I know what to do next."**

---

# Product Principle

The central design principle is:

> **Don't just give me an answer. Help me understand the problem well enough to find a better answer.**

The AI should behave less like an answer machine and more like a **thinking partner**.

---

# Success Criteria

The MVP is successful if a user can:

1. Enter an unstructured idea or problem.
2. Have a meaningful conversation with the AI about it.
3. See the AI identify and structure the important dimensions of the problem.
4. See that structure represented visually.
5. Use research to challenge or enrich their assumptions.
6. Explore alternative directions.
7. Leave with a concrete understanding of what to do next.

The strongest proof of the concept is not the quality of the final generated plan.

It is the **visible transformation from ambiguity to clarity.**

---

# One-Sentence Pitch

> **An AI thinking partner that helps you deconstruct vague ideas, explore the problem space, and turn your thinking into a visual map and actionable plan.**