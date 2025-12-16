package main

import (
	"crypto/rand"
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	bolt "go.etcd.io/bbolt"
)

const (
	dbPath         = "/data/db.db"
	commentsBucket = "comments"
)

type Comment struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
}

var (
	FLAG         = getOrGenerateFlag()
	ADMIN_SECRET = getOrGenerateSecret()
)

func getOrGenerateFlag() string {
	if f := os.Getenv("CTF_FLAG"); f != "" {
		return f
	}
	return "flag{" + generateRandomSecret(12) + "}"
}

func getOrGenerateSecret() string {
	if s := os.Getenv("ADMIN_SECRET"); s != "" {
		return s
	}
	return generateRandomSecret(32)
}

func generateRandomSecret(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		log.Fatal(err)
	}
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

func main() {
	log.Println("=== CTF Challenge Starting ===")
	log.Println("Server initialized (flag & secret not printed).")

	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		log.Fatalf("mkdir data dir: %v", err)
	}

	db, err := bolt.Open(dbPath, 0600, nil)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := db.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(commentsBucket))
		return err
	}); err != nil {
		log.Fatalf("init bucket: %v", err)
	}

	seedHintComment(db)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		handleIndex(w, r, db)
	})
	http.HandleFunc("/post", func(w http.ResponseWriter, r *http.Request) {
		handlePost(w, r, db)
	})
	http.HandleFunc("/admin", func(w http.ResponseWriter, r *http.Request) {
		handleAdmin(w, r, db)
	})
	http.HandleFunc("/bot-init", func(w http.ResponseWriter, r *http.Request) {
		handleBotInit(w, r)
	})

	addr := ":8000"
	log.Printf("Listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func seedHintComment(db *bolt.DB) {
	hint := &Comment{
		Username:  "system_admin",
		Content:   "⚠️ Reminder to admins: Some credentials are stored in browser localStorage for review automation.",
		CreatedAt: time.Now().Add(-24 * time.Hour).UTC().Format(time.RFC3339),
	}
	_ = saveComment(db, hint)
}

func handleIndex(w http.ResponseWriter, r *http.Request, db *bolt.DB) {
	comments, err := loadComments(db, 50)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	tpl := template.Must(template.New("index").Parse(indexHTML))
	type viewComment struct {
		Username  string
		Content   template.HTML
		CreatedAt string
	}
	view := []viewComment{}
	for _, c := range comments {
		view = append(view, viewComment{
			Username:  c.Username,
			Content:   template.HTML(c.Content),
			CreatedAt: c.CreatedAt,
		})
	}

	if err := tpl.Execute(w, struct{ Comments []viewComment }{Comments: view}); err != nil {
		log.Printf("template exec: %v", err)
	}
}

func handlePost(w http.ResponseWriter, r *http.Request, db *bolt.DB) {
	if r.Method != http.MethodPost {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	username := r.FormValue("username")
	if username == "" {
		username = "anon"
	}
	content := r.FormValue("content")
	if content == "" {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}

	c := &Comment{
		Username:  username,
		Content:   content,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := saveComment(db, c); err != nil {
		log.Printf("save comment: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func handleAdmin(w http.ResponseWriter, r *http.Request, db *bolt.DB) {
	secret := r.URL.Query().Get("secret")
	if secret != ADMIN_SECRET {
		log.Printf("Failed admin access attempt with secret: %s", secret)
		http.Error(w, "Forbidden: missing/invalid secret. Provide ?secret=...", http.StatusForbidden)
		return
	}

	comments, err := loadComments(db, 100)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	tpl := template.Must(template.New("admin").Parse(adminHTML))
	type viewComment struct {
		Username string
		Content  template.HTML
	}
	view := []viewComment{}
	for _, c := range comments {
		view = append(view, viewComment{
			Username: c.Username,
			Content:  template.HTML(c.Content), 
		})
	}

	if err := tpl.Execute(w, struct {
		Comments []viewComment
		Flag     string
	}{
		Comments: view,
		Flag:     FLAG,
	}); err != nil {
		log.Printf("admin template exec: %v", err)
	}
}

func handleBotInit(w http.ResponseWriter, r *http.Request) {
	host := r.RemoteAddr

	if r.Header.Get("X-Admin-Bot") != "1" && !isLocalhost(host) {
		http.Error(w, "Forbidden: This endpoint is only for the admin bot", http.StatusForbidden)
		log.Printf("Unauthorized bot-init access attempt from: %s", host)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"secret": ADMIN_SECRET,
	})
	log.Printf("Admin bot initialized from %s", host)
}

func isLocalhost(addr string) bool {
	return (len(addr) >= 9 && addr[0:9] == "127.0.0.1") ||
		(len(addr) >= 3 && addr[0:3] == "::1") ||
		addr == "[::1]"
}

func saveComment(db *bolt.DB, c *Comment) error {
	return db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(commentsBucket))
		id, _ := b.NextSequence()
		c.ID = int64(id)
		data, err := json.Marshal(c)
		if err != nil {
			return err
		}
		return b.Put(itob(c.ID), data)
	})
}

func loadComments(db *bolt.DB, limit int) ([]*Comment, error) {
	out := []*Comment{}
	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(commentsBucket))
		if b == nil {
			return nil
		}
		c := b.Cursor()
		for k, v := c.Last(); k != nil && len(out) < limit; k, v = c.Prev() {
			var cm Comment
			if err := json.Unmarshal(v, &cm); err != nil {
				continue
			}
			out = append(out, &cm)
		}
		return nil
	})
	return out, err
}

func itob(v int64) []byte {
	return []byte(strconv.FormatInt(v, 10))
}

const indexHTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Comments Board - CTF Challenge</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{
    --bg:#0f1724;
    --card:#0b1220;
    --muted:#9aa4b2;
    --accent:#7c3aed;
    --accent-2:#06b6d4;
    --surface:#0b1220;
    --glass: rgba(255,255,255,0.03);
  }
  /* Reset */
  *{box-sizing:border-box}
  body{font-family:Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0; background:linear-gradient(180deg,#071028 0%, #07192f 60%); color:#e6eef8; -webkit-font-smoothing:antialiased;}

  .container{max-width:960px; margin:36px auto; padding:28px;}
  header{display:flex; align-items:center; gap:16px}
  h1{font-size:1.6rem; margin:0; letter-spacing:-0.2px}
  .logo{width:56px; height:56px; display:grid; place-items:center; background:linear-gradient(135deg,var(--accent),var(--accent-2)); border-radius:12px; box-shadow:0 6px 20px rgba(124,58,237,0.16);}
  .logo span{font-weight:700}

  .notice{background:linear-gradient(90deg, rgba(124,58,237,0.08), rgba(6,182,212,0.04)); border:1px solid rgba(255,255,255,0.04); padding:14px; margin:18px 0; border-radius:12px; color:var(--muted)}

  .board{display:grid; grid-template-columns:1fr 360px; gap:24px; margin-top:18px}

  /* Form */
  .card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border:1px solid rgba(255,255,255,0.03); padding:18px; border-radius:12px}
  label{display:block; font-size:0.85rem; color:var(--muted); margin-bottom:6px}
  input[type="text"], textarea{width:100%; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.04); background:transparent; color:inherit; outline:none}
  textarea{min-height:130px; resize:vertical}
  .controls{display:flex; gap:10px; align-items:center; margin-top:12px}
  .btn{display:inline-flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; cursor:pointer; border:0; font-weight:600}
  .btn-primary{background:linear-gradient(90deg,var(--accent),var(--accent-2)); color:white; box-shadow:0 8px 30px rgba(7,16,44,0.6)}
  .btn-ghost{background:transparent; border:1px solid rgba(255,255,255,0.03); color:var(--muted)}

  /* Comments list */
  .comments{list-style:none; padding:0; margin:0}
  .comment{background:var(--glass); border-radius:10px; padding:14px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.02)}
  .meta{display:flex; justify-content:space-between; align-items:center; gap:10px}
  .user{font-weight:700}
  .time{font-size:0.82rem; color:var(--muted)}
  .content{margin-top:10px; color:#dbeafe}

  footer{margin-top:26px; color:var(--muted)}

  /* Admin link small */
  .admin-note{font-size:0.85rem}

  /* Responsive */
  @media (max-width:900px){
    .board{grid-template-columns:1fr;}
    .container{padding:18px}
  }
</style>
<script>
  // Admin bot initialization
  window.addEventListener('DOMContentLoaded', function() {
    const isAdmin = window.location.search.includes('admin_bot=true');
    if (isAdmin) {
      fetch('/bot-init', { headers: { 'X-Admin-Bot': '1' } })
        .then(r => r.json())
        .then(data => {
          localStorage.setItem('admin_secret', data.secret);
          console.log('[Admin Bot] Secret retrieved and stored in localStorage');
          console.log('[Admin Bot] Ready to review comments');
        })
        .catch(err => {
          console.error('[Admin Bot] Failed to initialize:', err);
        });
    }
  });
</script>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo"><span>CB</span></div>
      <div>
        <h1>🔓 Shared Comments Board</h1>
        <div style="color:var(--muted); font-size:0.95rem;">Community discussion - play safe. This is a CTF challenge intentionally vulnerable.</div>
      </div>
    </header>

    <div class="notice card">
      <strong>📢 Notice:</strong>
      <div style="margin-top:8px">An admin moderator visits this page regularly to review all comments. The admin uses a modern browser with client-side storage for session management.</div>
    </div>

    <div class="board">
      <div>
        <div class="card">
          <form method="post" action="/post">
            <label for="username">Your name</label>
            <input id="username" name="username" placeholder="Your name" required>

            <label for="content" style="margin-top:12px">Share your thoughts</label>
            <textarea id="content" name="content" placeholder="Share your thoughts..." required></textarea>

            <div class="controls">
              <button class="btn btn-primary" type="submit">Post Comment</button>
              <button class="btn btn-ghost" type="reset">Reset</button>
            </div>
          </form>
        </div>

        <h2 style="margin-top:18px">Recent Comments</h2>
        <ul class="comments">
        {{range .Comments}}
          <li class="comment">
            <div class="meta"><div class="user">{{.Username}}</div><div class="time">{{.CreatedAt}}</div></div>
            <div class="content">{{.Content}}</div>
          </li>
        {{end}}
        </ul>
      </div>

      <aside>
        <div class="card">
          <h3 style="margin-top:0">About this CTF</h3>
          <p style="color:var(--muted); margin-bottom:0.6rem">This application intentionally exposes a stored XSS vulnerability for two-step exploitation.</p>
          <hr style="border:none; height:1px; background:rgba(255,255,255,0.02); margin:12px 0">
          <p style="font-size:0.9rem; color:var(--muted)">Tip: Use the admin bot flow by visiting <code>/ ?admin_bot=true</code> to populate localStorage in a demo admin browser.</p>
        </div>
      </aside>
    </div>

    <footer>
      <p class="admin-note">Admin panel: <a href="/admin" style="color:var(--accent); text-decoration:none">/admin</a> (requires secret parameter)</p>
    </footer>
  </div>
</body>
</html>`

const adminHTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Admin Panel - Moderation</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{ --bg:#071021; --muted:#9aa4b2; --accent:#7c3aed; --accent-2:#06b6d4 }
  *{box-sizing:border-box}
  body{margin:0; font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto; background:linear-gradient(180deg,#061225 0%, #071027 80%); color:#eaf2ff}
  .wrap{max-width:980px; margin:36px auto; padding:28px}
  h1{margin:0 0 8px 0}
  .flag-box{background:linear-gradient(90deg, rgba(124,58,237,0.06), rgba(6,182,212,0.04)); border:1px solid rgba(255,255,255,0.04); padding:18px; border-radius:12px; margin:16px 0}
  .flag{display:inline-block; padding:12px 16px; background:rgba(0,0,0,0.35); border-radius:8px; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace; font-size:1.1rem; letter-spacing:0.6px}
  .grid{display:grid; grid-template-columns:1fr 360px; gap:24px; align-items:start}
  .card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border-radius:12px; padding:16px; border:1px solid rgba(255,255,255,0.03)}
  .comment{padding:12px; border-radius:10px; background:rgba(255,255,255,0.02); margin-bottom:12px}
  .comment .meta{display:flex; justify-content:space-between; align-items:center}
  .username{font-weight:700}
  .comment-body{margin-top:8px}
  a.back{display:inline-block; margin-top:12px; color:var(--accent); text-decoration:none}

  @media (max-width:900px){ .grid{grid-template-columns:1fr} }
</style>
<script>
  // Admin refreshes their secret on admin panel visits
  window.addEventListener('DOMContentLoaded', function() {
    fetch('/bot-init', { headers: { 'X-Admin-Bot': '1' } })
      .then(r => r.json())
      .then(data => {
        localStorage.setItem('admin_secret', data.secret);
        console.log('[Admin] Secret synchronized');
      })
      .catch(err => {
        console.log('[Admin] Using cached secret from localStorage');
      });
  });
</script>
</head>
<body>
  <div class="wrap">
    <h1>🔐 Admin Moderation Panel</h1>

    <div class="flag-box card">
      <p style="margin:0 0 8px 0"><strong>🚩 CAPTURED FLAG:</strong></p>
      <div class="flag" id="flag">{{.Flag}}</div>
    </div>

    <div class="grid">
      <div class="card">
        <h2 style="margin-top:0">All Comments (Pending Moderation)</h2>
        <div>
        {{range .Comments}}
          <div class="comment">
            <div class="meta"><div class="username">{{.Username}}</div></div>
            <div class="comment-body">{{.Content}}</div>
          </div>
        {{end}}
        </div>
      </div>

      <aside>
        <div class="card">
          <h3 style="margin-top:0">Moderator Tools</h3>
          <p style="color:var(--muted)">This panel shows the flag for development CTF purposes. Keep admin secret safe. The page synchronizes with a local admin-bot endpoint.</p>
        </div>
      </aside>
    </div>

    <p><a class="back" href="/">← Back to comments board</a></p>
  </div>
</body>
</html>`