import express from 'express';
import pg from 'pg';

const app = express();
app.use(express.json());

// Universal CORS headers for Claude's internet client
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

// Mandatory Web Discovery Manifest that Claude scans to verify auth requirements
app.get('/.well-known/mcp', (req, res) => {
  res.json({
    mcpVersion: "2026-07-28",
    capabilities: { tools: {} },
    tools: [
      {
        name: "save_weekly_schedule",
        description: "Saves a generated weekly schedule with tasks, lunch blocks, and water breaks.",
        inputSchema: {
          type: "object",
          properties: {
            time_slots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string" },
                  start_time: { type: "string" },
                  end_time: { type: "string" },
                  title: { type: "string" },
                  type: { type: "string" },
                  importance: { type: "string" }
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

// Route where Claude handles actual tool execution requests over the internet
app.post('/sse', async (req, res) => {
  try {
    const { time_slots } = req.body;
    if (!time_slots) return res.status(400).json({ error: "Missing time slots" });
    
    await pool.query("DELETE FROM calendar_tasks");
    for (const slot of time_slots) {
      await pool.query(
        "INSERT INTO calendar_tasks (day, start_time, end_time, title, type, importance) VALUES ($1, $2, $3, $4, $5, $6)",
        [slot.day, slot.start_time, slot.end_time, slot.title, slot.type, slot.importance]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Fetch schedule data for the Beige Frontend Grid
app.get('/api/schedule', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM calendar_tasks ORDER BY day, start_time ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Beige Aesthetic Dashboard Layout
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Weekly Outlook &bull; ChronoPlan</title>
      <script src="https://tailwindcss.com"></script>
      <link href="https://googleapis.com" rel="stylesheet">
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f7f4ef; }
        .serif-title { font-family: 'Cinzel', serif; letter-spacing: 0.05em; }
      </style>
    </head>
    <body class="text-stone-700 min-h-screen">
      <nav class="max-w-7xl mx-auto py-8 px-6 flex justify-between items-center border-b border-stone-200/60">
        <div class="flex flex-col">
          <span class="serif-title text-xl font-medium tracking-wider text-stone-800">ChronoPlan</span>
          <span class="text-[11px] text-stone-400 font-medium uppercase tracking-widest mt-0.5">The Weekly Routine Engine</span>
        </div>
        <button onclick="fetchSchedule()" class="px-5 py-2.5 text-xs bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-full transition shadow-xs uppercase tracking-wider font-medium">
          🔄 Sync Timeline
        </button>
      </nav>
      <main class="max-w-7xl mx-auto p-6 mt-4">
        <div class="mb-8">
          <h1 class="serif-title text-2xl font-medium text-stone-800">Weekly Outlook</h1>
          <p class="text-xs text-stone-400 font-medium mt-1">A curated space mapping out your priorities, targets, and breaks balance frames.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-6" id="calendar-grid"></div>
      </main>
      <script>
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        async function fetchSchedule() {
          const res = await fetch('/api/schedule');
          const tasks = await res.json();
          const grid = document.getElementById('calendar-grid');
          grid.innerHTML = '';
          days.forEach(day => {
            const dayTasks = tasks.filter(t => t.day === day);
            let dayHtml = \`<div class="bg-white/80 border border-stone-200/50 rounded-2xl p-5 shadow-xs backdrop-blur-xs min-h-[460px] flex flex-col">
              <h3 class="serif-title font-medium text-stone-800 border-b border-stone-100 pb-2 mb-4 text-center tracking-wide text-xs uppercase">\${day}</h3><div class="space-y-3.5 flex-1">\`;
            if(dayTasks.length === 0) {
              dayHtml += \`<div class="flex flex-col items-center justify-center py-20 text-stone-400"><span class="text-lg">🌿</span><p class="text-[11px] font-medium tracking-wide mt-2 text-center">Quiet day ahead</p></div>\`;
            } else {
              dayTasks.forEach(task => {
                let bgClass = "bg-stone-50 border-stone-200/60 text-stone-700";
                if(task.type === 'lunch') bgClass = "bg-[#ebdccb] border-[#decbb7] text-stone-800 font-medium";
                if(task.type === 'break') bgClass = "bg-[#dbe1d9] border-[#cbd3c7] text-stone-700 text-[11px] text-center italic tracking-wide";
                if(task.importance === 'v imp') bgClass = "bg-[#d4b0a2]/50 border-[#c49b88] text-stone-900 font-semibold ring-1 ring-[#decbb7]";
                dayHtml += \`<div class="p-3.5 border rounded-xl shadow-2xs \${bgClass}">
                  <div class="font-mono text-[10px] text-stone-400 mb-1 font-medium">\${task.start_time} - \${task.end_time}</div>
                  <div class="text-xs font-medium tracking-wide text-stone-800">\${task.title}</div>
                </div>\`;
              });
            }
            dayHtml += '</div></div>';
            grid.innerHTML += dayHtml;
          });
        }
        window.onload = fetchSchedule;
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server online on port ${PORT}`));
