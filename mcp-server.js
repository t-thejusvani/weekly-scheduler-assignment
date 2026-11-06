import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Open the local standalone SQLite database file matching server.js
const db = await open({
  filename: "./schedule.db",
  driver: sqlite3.Database
});

const server = new Server(
  { name: "weekly-scheduler-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "save_weekly_schedule") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  try {
    const { time_slots } = request.params.arguments;
    
    // Clear out old data matching user refresh requests
    await db.run("DELETE FROM calendar_tasks");

    for (const slot of time_slots) {
      await db.run(
        "INSERT INTO calendar_tasks (day, start_time, end_time, title, type, importance) VALUES (?, ?, ?, ?, ?, ?)",
        [slot.day, slot.start_time, slot.end_time, slot.title, slot.type, slot.importance]
      );
    }

    return {
      content: [{ type: "text", text: `Successfully built and saved ${time_slots.length} time blocks into your aesthetic local dashboard.` }]
    };
  } catch (error) {
    return { content: [{ type: "text", text: `Database error: ${error.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP Scheduler Server running locally!");
