import express from 'express';
import pg from 'pg';

const app = express();
app.use(express.json());

// Enable CORS so Claude's internet client can connect cleanly
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Cloud Database Connection Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:Tq6zyWzmfuQFnOCb@db.kljclvaqsnooaxoayqnw.supabase.co:5432/postgres"
});

// 1. Universal MCP Web Discovery Manifest (Tells Claude what tools exist over the web)
app.get('/.well-known/mcp', (req, res) => {
  res.json({
    mcpVersion: "2026-07-28",
    capabilities: { tools: {} },
    tools: [
      {
        name: "save_weekly_schedule",
        description: "Saves a generated weekly calendar schedule containing prioritized tasks, mandatory 10-min water breaks every hour, buffer blocks, and lunch.",
        inputSchema: {
          type: "object",
          properties: {
            time_slots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string", enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
                  start_time: { type: "string" },
                  end_time: { type: "string" },
                  title: { type: "string" },
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
  });
});

// 2. Direct Web Tool Execution Route
app.post('/api/save-weekly-schedule', async (req, res) => {
  try {
    const { time_slots } = req.body;
    if (!time_slots || !Array.isArray(time_slots)) {
      return res.status(400).json({ error: "Invalid schedule format" });
    }
    
    await pool.query("DELETE FROM calendar_tasks");
    for (const slot of time_slots) {
      await pool.query(
        "INSERT INTO calendar_tasks (day, start_time, end_time, title, type, importance) VALUES ($1, $2, $3, $4, $5, $6)",
        [slot.day, slot.start_time, slot.end_time, slot.title, slot.type, slot.importance]
      );
    }
    res.json({ success: true, message: `Scheduled ${time_slots.length} slots successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. API: Fetch schedule for the Frontend Grid Interface
app.get('/api/schedule', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM calendar_tasks ORDER BY day, start_time ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Serve the Colorful Editable UI Calendar Grid Dashboard
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Weekly Smart Planner</title>
      <script src="https://tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 text-slate-800 min-h-screen font-sans p-8">
      <nav class="bg-white border border-slate-200 py-4 px-8 rounded-xl flex justify-between items-center shadow-xs mb-8 max-w-7xl mx-auto">
        <div class="flex items-center space-x-3">
          <span class="text-xl font-bold text-emerald-600">📅 ChronoPlan Web-MCP</span>
        </div>
        <button onclick="fetchSchedule()" class="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition shadow-xs">🔄 Sync Live Timeline</button>
      </nav>
      <main class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6" id="calendar-grid"></main>
      <script>
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        async function fetchSchedule() {
          const res = await fetch('/api/schedule');
          const tasks = await res.json();
          const grid = document.getElementById('calendar-grid');
          grid.innerHTML = '';
          days.forEach(day => {
            const dayTasks = tasks.filter(t => t.day === day);
            let html = \`<div class="bg-white border border-slate-200 rounded-xl p-4 shadow-xs min-h-[450px]">
              <h3 class="font-bold text-slate-400 border-b pb-2 mb-3 text-center text-xs tracking-wide uppercase">\${day}</h3><div class="space-y-3">\`;
            if(dayTasks.length === 0) {
              html += \`<p class="text-xs text-slate-400 text-center py-12">No tasks mapped yet.</p>\`;
            } else {
              dayTasks.forEach(task => {
                let bg = "bg-emerald-50 border-emerald-200 text-emerald-900";
                if(task.type === 'lunch') bg = "bg-amber-400 border-amber-500 text-amber-950 font-bold text-center";
                if(task.type === 'break') bg = "bg-sky-400 border-sky-500 text-white font-semibold text-center";
                if(task.type === 'buffer') bg = "bg-indigo-50 border-indigo-300 text-indigo-800 border-dashed";
                if(task.importance === 'v imp') bg = "bg-gradient-to-br from-rose-500 to-pink-600 border-rose-600 text-white font-bold shadow-sm";
                html += \`<div class="p-3 border rounded-lg text-xs \${bg}">
                  <div class="font-mono text-[10px] opacity-70 mb-1">\${task.start_time} - \${task.end_time}</div>
                  <div class="font-medium">\${task.title}</div>
                </div>\`;
              });
            }
            html += '</div></div>';
            grid.innerHTML += html;
          });
        }
        window.onload = fetchSchedule;
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`App online on port ${PORT}`));
