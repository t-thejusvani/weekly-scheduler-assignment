import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
app.use(express.json());

// Store latest tasks in-memory or sync them
let currentSchedule = {
    "Monday": [{ id: 1, title: "Review Assignment", priority: "v imp", completed: false }]
};

// Initialize MCP Server
const mcpServer = new Server(
    { name: "focusflow-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

// Define tool for Claude to call
mcpServer.setRequestHandler("tools/list", async () => ({
    tools: [{
        name: "update_weekly_schedule",
        description: "Push structured weekly tasks and work blocks into the FocusFlow app",
        inputSchema: {
            type: "object",
            properties: {
                schedule: { type: "object", description: "Day-by-day task lists" }
            },
            required: ["schedule"]
        }
    }]
}));

mcpServer.setRequestHandler("tools/call", async (request) => {
    if (request.params.name === "update_weekly_schedule") {
        currentSchedule = request.params.arguments.schedule;
        return { content: [{ type: "text", text: "Schedule successfully updated!" }] };
    }
    throw new Error("Tool not found");
});

let transport;
app.get('/sse', async (req, res) => {
    transport = new SSEServerTransport('/messages', res);
    await mcpServer.connect(transport);
});

app.post('/messages', async (req, res) => {
    if (transport) {
        await transport.handlePostMessage(req, res);
    }
});

// Endpoint for your frontend app to fetch the schedule
app.get('/api/schedule', (req, res) => {
    res.json(currentSchedule);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`FocusFlow MCP Server running on port ${PORT}`);
});
