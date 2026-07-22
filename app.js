/**
 * NexusCSV - CSV to Nested JSON Converter
 * Client-side engine orchestrating CSV parsing, schema configuration, and recursive nesting.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements State Variables ---
  let rawCsvData = '';
  let parsedHeaders = [];
  let parsedRows = [];
  let schema = []; // Array of column configs: { name, targetPath, type, included }
  let currentIndentation = '2'; // '2', '4', or 'minify'
  let parsedFileName = 'nexus_data.csv';

  // --- DOM Elements ---
  const autoNestToggle = document.getElementById('auto-nest-toggle');
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const csvDropzone = document.getElementById('csv-dropzone');
  const csvFileInput = document.getElementById('csv-file-input');
  const fileInfoBadge = document.getElementById('file-info-badge');
  const fileBadgeName = document.getElementById('file-badge-name');
  const removeFileBtn = document.getElementById('remove-file-btn');
  const csvPasteArea = document.getElementById('csv-paste-area');
  
  // Settings
  const csvDelimiter = document.getElementById('csv-delimiter');
  const csvHasHeader = document.getElementById('csv-has-header');
  const csvSkipEmpty = document.getElementById('csv-skip-empty');

  // Schema Table
  const schemaCard = document.getElementById('schema-card');
  const schemaTbody = document.getElementById('schema-tbody');
  const schemaSearch = document.getElementById('schema-search');
  const bulkIncludeAll = document.getElementById('bulk-include-all');
  const bulkExcludeAll = document.getElementById('bulk-exclude-all');
  const bulkResetPaths = document.getElementById('bulk-reset-paths');

  // Output Preview
  const outputStats = document.getElementById('output-stats');
  const formatButtons = document.querySelectorAll('.format-btn');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const downloadJsonBtn = document.getElementById('download-json-btn');
  const emptyOutputState = document.getElementById('empty-output-state');
  const jsonCodeContainer = document.getElementById('json-code-container');
  const jsonCodeOutput = document.getElementById('json-code-output');
  const loadSampleBtn = document.getElementById('load-sample-btn');

  // Initialize Lucide Icons
  lucide.createIcons();

  // --- Tab Switching ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));

      tab.classList.add('active');
      const targetContent = document.getElementById(tab.dataset.tab);
      targetContent.classList.add('active');
    });
  });

  // --- Sample Data Loader ---
  const sampleCSV = `id,info.name,info.contact.email,roles,metadata.created_at,score,active
101,Alice Vance,alice@example.com,"admin,developer",2026-07-22T10:00:00Z,94.5,true
102,Bob Miller,bob@example.com,user,2026-07-22T10:05:00Z,88.0,true
103,Charlie Smith,charlie@example.com,"user,editor",2026-07-22T11:20:00Z,76.2,false`;

  loadSampleBtn.addEventListener('click', () => {
    // Switch to paste tab
    const pasteTabBtn = document.querySelector('[data-tab="paste-tab"]');
    pasteTabBtn.click();
    csvPasteArea.value = sampleCSV;
    rawCsvData = sampleCSV;
    parsedFileName = 'sample_data.csv';
    processCSV();
  });

  // --- Drag & Drop Handlers ---
  ['dragenter', 'dragover'].forEach(eventName => {
    csvDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      csvDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    csvDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      csvDropzone.classList.remove('dragover');
    }, false);
  });

  csvDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  csvDropzone.addEventListener('click', () => {
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    parsedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      rawCsvData = e.target.result;
      
      // Update UI File badge
      fileBadgeName.textContent = file.name;
      fileInfoBadge.classList.remove('hidden');
      csvDropzone.classList.add('hidden');

      processCSV();
    };
    reader.readAsText(file);
  }

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileInput();
  });

  function resetFileInput() {
    csvFileInput.value = '';
    rawCsvData = '';
    fileInfoBadge.classList.add('hidden');
    csvDropzone.classList.remove('hidden');
    clearOutput();
  }

  // --- Raw Text Paste Input Handlers ---
  csvPasteArea.addEventListener('input', () => {
    rawCsvData = csvPasteArea.value;
    parsedFileName = 'pasted_data.csv';
    processCSV();
  });

  // --- Settings Listeners ---
  [csvDelimiter, csvHasHeader, csvSkipEmpty].forEach(el => {
    el.addEventListener('change', () => {
      if (rawCsvData) processCSV();
    });
  });

  autoNestToggle.addEventListener('change', () => {
    // If we toggle auto-nest, we recalculate schema paths
    if (schema.length > 0) {
      updateSchemaPathsFromHeaders();
      renderSchemaTable();
      generateJSON();
    }
  });

  // --- CSV Parser Orchestration ---
  function processCSV() {
    if (!rawCsvData || rawCsvData.trim() === '') {
      clearOutput();
      return;
    }

    const config = {
      delimiter: csvDelimiter.value === 'auto' ? '' : csvDelimiter.value,
      skipEmptyLines: csvSkipEmpty.checked ? 'greedy' : false,
      header: false // We parse row lists to maintain custom index/header mappings
    };

    Papa.parse(rawCsvData, {
      ...config,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          showError(`CSV Parsing Error: ${results.errors[0].message}`);
          return;
        }

        const data = results.data;
        if (data.length === 0) {
          clearOutput();
          return;
        }

        let headers = [];
        let rows = [];

        if (csvHasHeader.checked) {
          headers = data[0].map(h => h ? h.trim() : 'UnnamedColumn');
          rows = data.slice(1);
        } else {
          // Generate artificial headers if none
          const colCount = data.reduce((max, row) => Math.max(max, row.length), 0);
          for (let i = 1; i <= colCount; i++) {
            headers.push(`Column_${i}`);
          }
          rows = data;
        }

        parsedHeaders = headers;
        parsedRows = rows;

        // Build Schema State
        initializeSchema();
        renderSchemaTable();
        schemaCard.classList.remove('hidden');

        generateJSON();
      },
      error: (err) => {
        showError(`Failed to parse CSV file: ${err.message}`);
      }
    });
  }

  // --- Schema Handling ---
  function initializeSchema() {
    schema = parsedHeaders.map((header) => {
      // Auto detect target nested path
      const targetPath = header;
      
      // Auto detect type from first few values in rows
      let detectedType = 'auto';
      
      return {
        name: header,
        targetPath: targetPath,
        type: detectedType,
        included: true
      };
    });
  }

  function updateSchemaPathsFromHeaders() {
    schema.forEach(col => {
      // By default, the path matches the original column header name.
      // Changing auto-nest toggle does not reset custom edits, but provides clean defaults.
      col.targetPath = col.name;
    });
  }

  function renderSchemaTable() {
    schemaTbody.innerHTML = '';
    const searchVal = schemaSearch.value.toLowerCase();

    schema.forEach((col, index) => {
      // Filter if search is active
      if (searchVal && 
          !col.name.toLowerCase().includes(searchVal) && 
          !col.targetPath.toLowerCase().includes(searchVal)) {
        return;
      }

      const tr = document.createElement('tr');
      if (!col.included) {
        tr.classList.add('row-excluded');
      }

      tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="col-checkbox" data-idx="${index}" ${col.included ? 'checked' : ''}>
        </td>
        <td>
          <span class="col-source-name" title="${col.name}">${col.name}</span>
        </td>
        <td>
          <input type="text" class="col-path-input" data-idx="${index}" value="${col.targetPath}" ${!col.included ? 'disabled' : ''}>
        </td>
        <td>
          <select class="col-type-select" data-idx="${index}" ${!col.included ? 'disabled' : ''}>
            <option value="auto" ${col.type === 'auto' ? 'selected' : ''}>Auto-Cast</option>
            <option value="string" ${col.type === 'string' ? 'selected' : ''}>String</option>
            <option value="number" ${col.type === 'number' ? 'selected' : ''}>Number</option>
            <option value="boolean" ${col.type === 'boolean' ? 'selected' : ''}>Boolean</option>
            <option value="array" ${col.type === 'array' ? 'selected' : ''}>Array (split)</option>
            <option value="null" ${col.type === 'null' ? 'selected' : ''}>Null</option>
          </select>
        </td>
      `;

      // Setup inputs change listeners
      const checkbox = tr.querySelector('.col-checkbox');
      const pathInput = tr.querySelector('.col-path-input');
      const typeSelect = tr.querySelector('.col-type-select');

      checkbox.addEventListener('change', (e) => {
        schema[index].included = e.target.checked;
        if (e.target.checked) {
          tr.classList.remove('row-excluded');
          pathInput.disabled = false;
          typeSelect.disabled = false;
        } else {
          tr.classList.add('row-excluded');
          pathInput.disabled = true;
          typeSelect.disabled = true;
        }
        generateJSON();
      });

      pathInput.addEventListener('input', (e) => {
        schema[index].targetPath = e.target.value.trim();
        generateJSON();
      });

      typeSelect.addEventListener('change', (e) => {
        schema[index].type = e.target.value;
        generateJSON();
      });

      schemaTbody.appendChild(tr);
    });
  }

  // --- Bulk Schema Actions ---
  bulkIncludeAll.addEventListener('click', () => {
    schema.forEach(col => col.included = true);
    renderSchemaTable();
    generateJSON();
  });

  bulkExcludeAll.addEventListener('click', () => {
    schema.forEach(col => col.included = false);
    renderSchemaTable();
    generateJSON();
  });

  bulkResetPaths.addEventListener('click', () => {
    updateSchemaPathsFromHeaders();
    renderSchemaTable();
    generateJSON();
  });

  schemaSearch.addEventListener('input', () => {
    renderSchemaTable();
  });

  // --- Nesting Logic Engine ---
  function generateJSON() {
    const isAutoNest = autoNestToggle.checked;
    const outputList = [];

    parsedRows.forEach((row) => {
      const rowObj = {};
      let hasData = false;

      schema.forEach((col, idx) => {
        if (!col.included) return;
        
        // CSV value can be undefined if row has fewer elements than headers
        const rawValue = row[idx] !== undefined ? row[idx] : '';
        const castedValue = castValue(rawValue, col.type);
        
        if (col.targetPath) {
          hasData = true;
          if (isAutoNest && col.targetPath.includes('.')) {
            // Split path by dot notation
            const pathParts = col.targetPath.split('.').map(p => p.trim()).filter(p => p !== '');
            if (pathParts.length > 0) {
              setNestedProperty(rowObj, pathParts, castedValue);
            }
          } else {
            // Flat key mapping
            rowObj[col.targetPath] = castedValue;
          }
        }
      });

      if (hasData) {
        outputList.push(rowObj);
      }
    });

    displayJSON(outputList);
  }

  // Helper to cast values
  function castValue(val, type) {
    if (val === undefined || val === null) return null;
    const trimmedVal = val.toString().trim();

    switch (type) {
      case 'string':
        return val.toString();
        
      case 'number':
        if (trimmedVal === '') return null;
        const num = Number(trimmedVal);
        return isNaN(num) ? null : num;
        
      case 'boolean':
        const lower = trimmedVal.toLowerCase();
        return lower === 'true' || lower === '1' || lower === 'yes';
        
      case 'array':
        if (trimmedVal === '') return [];
        // Split by comma, trim whitespace, and auto-cast members
        return trimmedVal.split(',').map(item => {
          const trimmedItem = item.trim();
          // Auto cast items in array
          if (!isNaN(Number(trimmedItem)) && trimmedItem !== '') {
            return Number(trimmedItem);
          }
          if (trimmedItem.toLowerCase() === 'true') return true;
          if (trimmedItem.toLowerCase() === 'false') return false;
          return trimmedItem;
        });
        
      case 'null':
        return null;
        
      case 'auto':
      default:
        // Try Number
        if (!isNaN(Number(trimmedVal)) && trimmedVal !== '') {
          return Number(trimmedVal);
        }
        // Try Boolean
        const l = trimmedVal.toLowerCase();
        if (l === 'true') return true;
        if (l === 'false') return false;
        // Try Empty/Null
        if (trimmedVal === '') return null;
        // Fallback String
        return val.toString();
    }
  }

  // Helper to set nested properties recursively, correcting type conflicts
  function setNestedProperty(obj, pathArray, value) {
    let current = obj;
    for (let i = 0; i < pathArray.length - 1; i++) {
      const key = pathArray[i];
      // If the node doesn't exist or is not a plain object, create one
      if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object' || Array.isArray(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }
    // Assign at leaf
    current[pathArray[pathArray.length - 1]] = value;
  }

  // --- Display and Formatting ---
  function displayJSON(jsonObj) {
    emptyOutputState.classList.add('hidden');
    jsonCodeContainer.classList.remove('hidden');

    let jsonString = '';
    if (currentIndentation === 'minify') {
      jsonString = JSON.stringify(jsonObj);
    } else {
      const indentCount = parseInt(currentIndentation, 10);
      jsonString = JSON.stringify(jsonObj, null, indentCount);
    }

    // Performance protection limit for syntax highlighting
    const isLargeFile = jsonString.length > 150000; // ~150KB

    if (isLargeFile) {
      jsonCodeOutput.textContent = jsonString;
      outputStats.textContent = `${jsonObj.length} records • Highlighting Off (large file)`;
    } else {
      jsonCodeOutput.innerHTML = syntaxHighlight(jsonString);
      outputStats.textContent = `${jsonObj.length} records`;
    }
    
    outputStats.classList.remove('hidden');
  }

  // Regular expression syntax highlighter
  function syntaxHighlight(json) {
    // Escape standard HTML chars to avoid XSS/rendering bugs
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  function clearOutput() {
    emptyOutputState.classList.remove('hidden');
    jsonCodeContainer.classList.add('hidden');
    outputStats.classList.add('hidden');
    schemaCard.classList.add('hidden');
    schemaTbody.innerHTML = '';
  }

  function showError(msg) {
    clearOutput();
    emptyOutputState.classList.remove('hidden');
    
    // Custom error state in container
    const originalContent = emptyOutputState.innerHTML;
    emptyOutputState.innerHTML = `
      <i data-lucide="alert-circle" class="empty-icon" style="color: var(--danger)"></i>
      <h3 style="color: var(--danger)">Parsing Failed</h3>
      <p style="max-width: 400px; margin-bottom: 24px;">${msg}</p>
      <button id="error-reset-btn" class="secondary-btn">Reset Interface</button>
    `;
    lucide.createIcons();

    document.getElementById('error-reset-btn').addEventListener('click', () => {
      emptyOutputState.innerHTML = originalContent;
      resetFileInput();
      // Re-attach sample listener
      document.getElementById('load-sample-btn').addEventListener('click', () => {
        const pasteTabBtn = document.querySelector('[data-tab="paste-tab"]');
        pasteTabBtn.click();
        csvPasteArea.value = sampleCSV;
        rawCsvData = sampleCSV;
        parsedFileName = 'sample_data.csv';
        processCSV();
      });
    });
  }

  // --- Indentation Modifiers ---
  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentIndentation = btn.dataset.indent;
      if (rawCsvData) {
        generateJSON();
      }
    });
  });

  // --- Clipboard Integration ---
  copyJsonBtn.addEventListener('click', () => {
    const textToCopy = jsonCodeOutput.textContent;
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      // Visual feedback via temporary notification
      showToast('JSON copied to clipboard!');
      
      // Temporary button icon update
      const btnText = copyJsonBtn.querySelector('.btn-text');
      const originalText = btnText.textContent;
      btnText.textContent = 'Copied!';
      
      setTimeout(() => {
        btnText.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Could not copy JSON: ', err);
    });
  });

  // --- File Download Integration ---
  downloadJsonBtn.addEventListener('click', () => {
    const textToDownload = jsonCodeOutput.textContent;
    if (!textToDownload) return;

    const blob = new Blob([textToDownload], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Create output filename: replace .csv with .json or append .json
    let outName = parsedFileName.replace(/\.[^/.]+$/, "") + '.json';
    
    link.setAttribute('href', url);
    link.setAttribute('download', outName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`Downloaded ${outName}`);
  });

  // --- Custom Notification Toast ---
  function showToast(message) {
    // Remove existing if any
    const existing = document.querySelector('.toast-notif');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notif';
    toast.innerHTML = `
      <i data-lucide="check-circle" style="width: 18px; height: 18px;"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }
});
