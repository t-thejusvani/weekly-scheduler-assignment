import express from 'express';
import pg from 'pg';

const app = express();
app.use(express.json());

// Connect using your Supabase URI string
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:Tq6zyWzmfuQFnOCb@db.kljclvaqsnooaxoayqnw.supabase.co:5432/postgres"
});

// API: Fetch current schedule data grouped by day
app.get('/api/schedule', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM calendar_tasks ORDER BY day, start_time ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Update an individual task when edited on the grid dashboard interface
app.post('/api/update-task', async (req, res) => {
  const { id, title, start_time, end_time } = req.body;
  try {
    await pool.query(
      "UPDATE calendar_tasks SET title = $1, start_time = $2, end_time = $3 WHERE id = $4",
      [title, start_time, end_time, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the Editable HTML/Tailwind Calendar Dashboard Interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Weekly Smart Planner</title>
      <script src="https://tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 text-slate-800 min-h-screen font-sans">
      <nav class="bg-white border-b border-slate-200 py-4 px-8 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div class="flex items-center space-x-3">
          <span class="text-xl font-bold text-emerald-600">📅 ChronoPlan MCP</span>
          <span class="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">9-5 Work Engine</span>
        </div>
        <button onclick="fetchSchedule()" class="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition font-medium">🔄 Sync Timeline</button>
      </nav>

      <main class="max-w-7xl mx-auto p-6 md:p-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold tracking-tight">Your Weekly Outlook</h1>
          <p class="text-sm text-slate-500 mt-1">Directly edit block titles or times in line. Changes save automatically.</p>
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
            let dayHtml = \`
              <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-h-[400px]">
                <h3 class="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-3 text-center tracking-wide text-sm uppercase text-slate-500">\${day}</h3>
                <div class="space-y-3">
            \`;

            if(dayTasks.length === 0) {
              dayHtml += \`<p class="text-xs text-slate-400 text-center py-8">No tasks mapped yet.</p>\`;
            } else {
              dayTasks.forEach(task => {
                let bgClass = "bg-slate-50 border-slate-200 text-slate-700";
                if(task.type === 'lunch') bgClass = "bg-orange-50 border-orange-200 text-orange-800 font-semibold";
                if(task.type === 'break') bgClass = "bg-blue-50 border-blue-200 text-blue-700 text-xs";
                if(task.type === 'buffer') bgClass = "bg-purple-50 border-purple-200 text-purple-700 border-dashed";
                if(task.importance === 'v imp') bgClass = "bg-rose-50 border-rose-300 text-rose-900 font-medium ring-1 ring-rose-200";

                dayHtml += \`
                  <div class="p-3 border rounded-lg text-xs transition relative group shadow-2xs hover:shadow-sm \${bgClass}">
                    <div class="flex gap-1 mb-1 items-center font-mono text-[10px] text-slate-400">
                      <input type="text" value="\${task.start_time}" onchange="updateTask(\${task.id}, 'start_time', this.value)" class="w-9 bg-transparent focus:bg-white focus:outline-none rounded text-center border-b border-transparent focus:border-slate-300" />
                      <span>-</span>
                      <input type="text" value="\${task.end_time}" onchange="updateTask(\${task.id}, 'end_time', this.value)" class="w-9 bg-transparent focus:bg-white focus:outline-none rounded text-center border-b border-transparent focus:border-slate-300" />
                    </div>
                    <textarea rows="2" onchange="updateTask(\${task.id}, 'title', this.value)" class="w-full bg-transparent font-medium focus:bg-white focus:outline-none focus:p-1 rounded resize-none border border-transparent focus:border-slate-300 focus:shadow-xs">\${task.title}</textarea>
                    \${task.importance && task.importance !== 'none' ? \`<span class="absolute top-2 right-2 text-[9px] uppercase px-1 rounded bg-white font-bold opacity-80 border border-slate-200">\${task.importance}</span>\` : ''}
                  </div>
                \`;
              });
            }

            dayHtml += \`</div></div>\`;
            grid.innerHTML += dayHtml;
          });
        }

        async function updateTask(id, field, value) {
          const response = await fetch('/api/schedule');
          const allTasks = await response.json();
          const task = allTasks.find(t => t.id === id);
          
          if(task) {
            task[field] = value;
            await fetch('/api/update-task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: task.id,
                title: task.title,
                start_time: task.start_time,
                end_time: task.end_time
              })
            });
          }
        }

        window.onload = fetchSchedule;
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Cloud Dashboard UI Online"));
