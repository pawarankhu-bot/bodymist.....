/* ==========================================================================
   Body Scent — shared script (used on every page)
   Each part runs only if its elements exist on the current page:
     product.html : #filter-bar, #product-list
     order.html   : #orderForm, #customerName, #contact, #items, #total, #note
     admin.html   : #ordersTable tbody
   ========================================================================== */

/* ---------- Config ---------- */
var ORDER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyAApwO3ky-Rw4xozVrbIHjY-s3IJs-gbqs0x2giLFaPqJcueMN6l0YFLF-JXcnLRohow/exec";

var SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfj2ui_XNBEiFg8gljlkXKw2CaqsQNyck0zALx8uoUu-F-fgUriLThE_kkCZa2Xu18LpEbVyjSfBEU/pub?gid=0&single=true&output=csv";

var MOODS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "fresh", label: "Fresh" },
  { key: "sweet", label: "Sweet" },
  { key: "confident", label: "Confident" },
  { key: "romance", label: "Romance" },
];

/* ---------- Helpers ---------- */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(price) {
  return Number(price).toLocaleString("th-TH");
}

/* ==========================================================================
   1. product.html — product cards + mood filter
   ========================================================================== */
var allProducts = [];

function initProducts() {
  var filterBar = document.getElementById("filter-bar");
  var list = document.getElementById("product-list");
  if (!filterBar || !list) return;

  var requestedMood = new URLSearchParams(window.location.search).get("mood");
  var validKeys = MOODS.map(function (m) {
    return m.key;
  });
  var activeMood =
    requestedMood && validKeys.indexOf(requestedMood.toLowerCase()) !== -1
      ? requestedMood.toLowerCase()
      : "all";

  renderFilterBar(filterBar, activeMood);

  filterBar.addEventListener("click", function (event) {
    var btn = event.target.closest(".filter__btn");
    if (!btn) return;
    setActiveFilter(filterBar, btn.getAttribute("data-filter"));
    renderProducts(list, btn.getAttribute("data-filter"));
  });

  list.innerHTML = '<p class="notice">กำลังโหลดสินค้า...</p>';

  fetch("products.json")
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (products) {
      allProducts = products;
      renderProducts(list, activeMood);
    })
    .catch(function (error) {
      console.error(error);
      list.innerHTML =
        '<p class="notice notice--error">โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง</p>';
    });
}

function renderFilterBar(filterBar, activeMood) {
  filterBar.classList.add("filter");
  filterBar.innerHTML = MOODS.map(function (m) {
    var dot =
      m.key === "all"
        ? ""
        : '<span class="mood-dot" data-mood="' + m.key + '"></span>';
    var active = m.key === activeMood ? " is-active" : "";
    return (
      '<button type="button" class="filter__btn' +
      active +
      '" data-filter="' +
      m.key +
      '">' +
      dot +
      escapeHtml(m.label) +
      "</button>"
    );
  }).join("");
}

function setActiveFilter(filterBar, mood) {
  filterBar.querySelectorAll(".filter__btn").forEach(function (btn) {
    btn.classList.toggle("is-active", btn.getAttribute("data-filter") === mood);
  });
}

function moodLabel(mood) {
  var found = MOODS.filter(function (m) {
    return m.key === mood;
  })[0];
  return found ? found.label : mood;
}

function buildItemName(product) {
  // Roll-on has no size in the data (null), so only add the size when present
  return product.size ? product.name + " " + product.size : product.name;
}

function renderProducts(list, mood) {
  var shown =
    mood === "all"
      ? allProducts
      : allProducts.filter(function (p) {
          return p.mood === mood;
        });

  if (shown.length === 0) {
    list.innerHTML = '<p class="notice">ไม่พบสินค้าในหมวดนี้</p>';
    return;
  }

  list.classList.add("product-grid");
  list.innerHTML = shown
    .map(function (p) {
      var params = new URLSearchParams({
        item: buildItemName(p),
        price: p.price,
      });
      var sizeText = p.size ? p.size : "โรลออน";
      return (
        '<article class="product-card" data-mood="' +
        escapeHtml(p.mood) +
        '">' +
        '<div class="product-card__media"><img src="' +
        escapeHtml(p.image) +
        '" alt="' +
        escapeHtml(p.name) +
        '" loading="lazy"></div>' +
        '<div class="product-card__body">' +
        '<span class="mood-label"><span class="mood-dot"></span>' +
        escapeHtml(moodLabel(p.mood)) +
        "</span>" +
        '<h3 class="product-card__title">' +
        escapeHtml(p.name) +
        "</h3>" +
        '<span class="product-card__meta">' +
        escapeHtml(sizeText) +
        "</span>" +
        '<div class="product-card__foot">' +
        '<span class="price">' +
        formatPrice(p.price) +
        "<small>บาท</small></span>" +
        '<a class="btn" href="order.html?' +
        params.toString() +
        '">สั่งซื้อ</a>' +
        "</div></div></article>"
      );
    })
    .join("");
}

/* ==========================================================================
   2. order.html — prefill from URL + submit to Apps Script
   ========================================================================== */
function initOrder() {
  var form = document.getElementById("orderForm");
  if (!form) return;

  // Prefill #items and #total from ?item=...&price=...
  var params = new URLSearchParams(window.location.search);
  var item = params.get("item");
  var price = params.get("price");
  var itemsField = document.getElementById("items");
  var totalField = document.getElementById("total");

  if (item !== null && itemsField) itemsField.value = item;
  if (price !== null && totalField) totalField.value = price;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    var payload = {
      customerName: document.getElementById("customerName").value,
      contact: document.getElementById("contact").value,
      items: document.getElementById("items").value,
      total: document.getElementById("total").value,
      note: document.getElementById("note").value,
    };

    fetch(ORDER_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(() => {
        window.location.href = "thankyou.html";
      })
      .catch((error) => {
        console.error(error);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        if (submitBtn) submitBtn.disabled = false;
      });
  });
}

/* ==========================================================================
   3. admin.html — read published Google Sheet (CSV) into a table
   ========================================================================== */

// Minimal CSV parser: handles quoted fields, "" escapes, commas and
// line breaks inside quotes, CRLF/LF line endings, and a leading BOM.
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function initAdmin() {
  var tbody = document.querySelector("#ordersTable tbody");
  if (!tbody) return;

  var COLS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

  function showMessage(text) {
    tbody.innerHTML = "";
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = COLS;
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage("กำลังโหลดข้อมูล...");

  fetch(SHEET_CSV_URL + "&_=" + Date.now(), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.text();
    })
    .then(function (text) {
      var rows = parseCSV(text).filter(function (r) {
        return r.some(function (cell) {
          return cell.trim() !== "";
        });
      });

      // Skip a header row if present (a real timestamp always contains digits)
      if (rows.length > 0 && !/\d/.test(rows[0][0] || "")) rows.shift();

      if (rows.length === 0) {
        showMessage("ยังไม่มีคำสั่งซื้อ");
        return;
      }

      // Rows are appended over time, so reversing puts the newest first
      rows.reverse();

      var fragment = document.createDocumentFragment();
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        for (var i = 0; i < COLS; i++) {
          var td = document.createElement("td");
          td.textContent = r[i] !== undefined ? r[i] : ""; // textContent: safe against HTML in orders
          tr.appendChild(td);
        }
        fragment.appendChild(tr);
      });

      tbody.innerHTML = "";
      tbody.appendChild(fragment);
    })
    .catch(function (error) {
      console.error(error);
      showMessage("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง");
    });
}

/* ---------- Start ---------- */
document.addEventListener("DOMContentLoaded", function () {
  initProducts();
  initOrder();
  initAdmin();
});
