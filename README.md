# NexusCSV - CSV to Nested JSON Converter

A premium, private, and high-performance developer tool to convert flat CSV spreadsheets into beautifully nested JSON structures right in your browser. 

*NexusCSV runs entirely client-side. No data is sent to external servers.*

## 🚀 Live Demo & Key Features

*   **Dot-Notation Auto-Detection**: Converts column headers like `user.profile.name` into structured sub-objects (`{ user: { profile: { name: "..." } } }`) automatically.
*   **Interactive Schema Mapping**: Exclude columns, rename keys, or customize nesting paths in real-time.
*   **Strict Type Casting**: Cast cells as numbers, booleans, strings, nulls, or split them into JSON arrays (e.g. converting a comma-separated column to `["admin", "dev"]`).
*   **Glow UI Dashboard**: Clean glassmorphism styling, responsive workspace layouts, and light/dark configurations.
*   **Performance Guard**: Automatically turns off syntax highlighting on files larger than 150KB to preserve CPU resources.

---

## 🛠️ Installation & Local Run

To run the application locally on your machine:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/ritabanm/nexus-csv.git
    cd nexus-csv
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the local development server**:
    ```bash
    npm run dev
    ```

4.  **Open in your browser**:
    Navigate to `http://localhost:3000/`.

---

## 📂 Project Structure

```
├── index.html       # Entrypoint page & skeleton
├── style.css        # Glassmorphic CSS design system
├── app.js           # Client-side nesting & parsing engine
├── package.json     # Node script configuration
├── .gitignore       # Untracked files selector
└── LICENSE          # MIT License
```

---

## 📝 License

This project is licensed under the [MIT License](LICENSE) - see the file for details.

---

*Made with ☕ by [ritabanm](https://github.com/ritabanm).*

💖 Support the Project
NexusCSV is built and maintained as a completely free, open-source tool. If it saves you time, helps your business, or you just want to support the project, feel free to buy me a coffee!

☕ Buy Me A Coffee
☕ **[Buy Me A Coffee](https://buymeacoffee.com/ritabanm)**
