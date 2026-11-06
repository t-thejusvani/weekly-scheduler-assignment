import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import pg from "pg";

// Initialize PostgreSQL Cloud Database Connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:Tq6zyWzmfuQFnOCb@db.kljclvaqsnooaxoayqnw.supabase.co:5432/postgres"
});

// Initialize the MCP Server
const server = new Server(
  { name: "weekly-scheduler-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Define the Tool Schema for Claude
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "save_weekly_schedule",
        description: "Saves a generated weekly calendar schedule containing prioritized tasks, mandatory 10-min water breaks every hour, buffer blocks, and lunch.",
        inputSchema: {
          type: "object",
          properties: {
            time_slots: {
              type: "array",
              description: "List of all timed blocks for the week from 9 AM to 5 PM.",
              items: {
                type: "object",
                properties: {
                  day: { type: "string", enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
                  start_time: { type: "string", description: "Format HH:MM (e.g. 09:00, 10:10)" },
                  end_time: { type: "string", description: "Format HH:MM (e.g. 10:00, 10:20)" },
                  title: { type: "string", description: "Name of the task, Water Break, Buffer Block, or Lunch" },
                  type: { type: "string", enum: ["task", "break", "buffer", "lunch"] },
                  importance: { type: "string", enum: ["v imp", "imp", "little imp", "none"] }
                },
                required: ["day", "start_time", "end_time", "title", "type", "importance"]
              }
            }
          },
          required: ["time_slots"]
        }
      }
    ]
  };
});

// Handle Execution Requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "save_weekly_schedule") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  try {
    const { time_slots } = request.params.arguments;
    
    // Clear out old data in the cloud table
    await pool.query("DELETE FROM calendar_tasks");

    // Insert each new slot into the cloud database
    for (const slot of time_slots) {
      await pool.query(
        "INSERT INTO calendar_tasks (day, start_time, end_time, title, type, importance) VALUES ($1, $2, $3, $4, $5, $6)",
        [slot.day, slot.start_time, slot.end_time, slot.title, slot.type, slot.importance]
      );
    }

    return {
      content: [{ type: "text", text: `Successfully built and scheduled ${time_slots.length} time blocks into your cloud calendar app dashboard.` }]
    };
  } catch (error) {
    return { content: [{ type: "text", text: `Database error: ${error.message}` }], isError: true };
  }
});

// Setup Express Web Server for Render
const app = express();
const port = process.env.PORT || 10000;

let transport;

// SSE endpoint to establish connection with Claude
app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

// Messages endpoint to handle tool execution calls from Claude
app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active SSE session found.");
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`MCP Scheduler Server online on port ${port} via cloud connection!`);
});