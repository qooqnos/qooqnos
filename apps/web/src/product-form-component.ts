/**
 * Simple & Intuitive Product Creation Form Component
 *
 * Implements the architecture guideline:
 * "Complexity belongs to the system; simplicity belongs to human."
 *
 * Question 1: "What do you want to add?"
 *   - Physical Good (کالا)
 *   - Digital Product (محصول دیجیتال)
 *
 * Question 2: "How many models or types does it have?"
 *   - Single type (یک نوع / ساده)
 *   - Multiple types / models (چند نوع / متغیر)
 *
 * Offers & Audience:
 *   - Consumer (مصرف‌کننده)
 *   - Partner (همکار)
 *   - Agent (نماینده)
 */

export type ProductNature = "physical" | "digital";
export type ProductStructure = "simple" | "variable";

export interface VariantCombinationRow {
  readonly id: string;
  readonly name: string;
  readonly attributes: Record<string, string>;
  readonly priceConsumer: number;
  readonly pricePartner?: number;
  readonly priceAgent?: number;
  readonly stock?: number; // Physical only
  readonly digitalFileName?: string; // Digital only
}

export interface NewProductFormData {
  readonly nature: ProductNature;
  readonly structure: ProductStructure;
  readonly title: string;
  readonly description: string;
  readonly basePriceConsumer: number;
  readonly basePricePartner?: number | undefined;
  readonly basePriceAgent?: number | undefined;
  readonly availableConsumer: boolean;
  readonly availablePartner: boolean;
  readonly availableAgent: boolean;
  // Physical properties
  readonly stockQuantity?: number | undefined;
  readonly weightGrams?: number | undefined;
  // Digital properties
  readonly digitalFile?: {
    readonly name: string;
    readonly sizeBytes?: number | undefined;
    readonly mimeType?: string | undefined;
    readonly version?: string | undefined;
  } | undefined;
  readonly digitalAccessDurationDays?: number | null | undefined; // null = permanent
  // Variable properties
  readonly variantOptions?: {
    readonly option1Name: string;
    readonly option1Values: string[];
    readonly option2Name?: string | undefined;
    readonly option2Values?: string[] | undefined;
  } | undefined;
  readonly variants?: VariantCombinationRow[] | undefined;
}

export interface ProductFormOptions {
  readonly onSave?: (data: NewProductFormData) => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly currencyLabel?: string;
}

export class ProductCreateFormComponent {
  private nature: ProductNature = "physical";
  private structure: ProductStructure = "simple";
  private option1Name = "رنگ";
  private option1Values: string[] = ["مشکی", "سفید"];
  private option2Name = "سایز";
  private option2Values: string[] = ["M", "L"];
  private uploadedFileName: string | null = null;
  private uploadedFileSize: string | null = null;

  constructor(private readonly options: ProductFormOptions = {}) {}

  /**
   * Generates Cartesian product combinations for variants
   */
  generateVariantRows(basePrice: number): VariantCombinationRow[] {
    const rows: VariantCombinationRow[] = [];
    const vals1 = this.option1Values.filter(Boolean);
    const vals2 = this.option2Values.filter(Boolean);

    if (vals1.length === 0) {
      return rows;
    }

    if (vals2.length === 0) {
      for (const v1 of vals1) {
        rows.push({
          id: `var-${v1}`,
          name: `${v1}`,
          attributes: { [this.option1Name]: v1 },
          priceConsumer: basePrice,
          pricePartner: Math.round(basePrice * 0.9),
          priceAgent: Math.round(basePrice * 0.8),
          stock: 10,
        });
      }
      return rows;
    }

    for (const v1 of vals1) {
      for (const v2 of vals2) {
        rows.push({
          id: `var-${v1}-${v2}`,
          name: `${v1} / ${v2}`,
          attributes: { [this.option1Name]: v1, [this.option2Name]: v2 },
          priceConsumer: basePrice,
          pricePartner: Math.round(basePrice * 0.9),
          priceAgent: Math.round(basePrice * 0.8),
          stock: 10,
        });
      }
    }

    return rows;
  }

  /**
   * Renders the complete, clean modal or page form HTML
   */
  render(): string {
    const isPhysical = this.nature === "physical";
    const isVariable = this.structure === "variable";
    const isDigital = this.nature === "digital";

    return `
      <div class="product-create-form glass-card" id="product-create-container">
        <!-- Form Header -->
        <div class="product-form-header">
          <div class="product-form-title-group">
            <span class="eyebrow"><i></i> ${isPhysical ? "کالای فیزیکی" : "محصول دیجیتال"} · ${isVariable ? "چند مدلی (متغیر)" : "ساده"}</span>
            <h2>افزودن محصول جدید</h2>
            <p>مشخصات کالا یا فایل دیجیتال خود را وارد کنید؛ تنظیمات قیمت و دسترسی به صورت هوشمند مدیریت می‌شود.</p>
          </div>
        </div>

        <form id="product-form-element" onsubmit="return false;" novalidate>
          <!-- Step 1: Product Nature Choice -->
          <div class="form-section">
            <label class="form-section-label">چه چیزی می‌خواهید اضافه کنید؟</label>
            <div class="nature-toggle-grid">
              <button type="button" class="nature-card ${isPhysical ? "active" : ""}" data-nature="physical">
                <span class="nature-icon">📦</span>
                <strong>کالا</strong>
                <small>محصول فیزیکی نیازمند انبار و ارسال</small>
              </button>
              <button type="button" class="nature-card ${isDigital ? "active" : ""}" data-nature="digital">
                <span class="nature-icon">⚡</span>
                <strong>محصول دیجیتال</strong>
                <small>فایل دانلودی، دوره، قالب یا محتوا</small>
              </button>
            </div>
          </div>

          <!-- Step 2: Structure Choice (Simple vs Variable) -->
          <div class="form-section">
            <label class="form-section-label">این محصول چند مدل یا نوع دارد؟</label>
            <div class="structure-toggle-row">
              <label class="choice-pill ${!isVariable ? "active" : ""}">
                <input type="radio" name="product_structure" value="simple" ${!isVariable ? "checked" : ""} />
                <span>یک نوع (ساده)</span>
              </label>
              <label class="choice-pill ${isVariable ? "active" : ""}">
                <input type="radio" name="product_structure" value="variable" ${isVariable ? "checked" : ""} />
                <span>چند نوع (${isPhysical ? "رنگ، سایز، مدل" : "فرمت، نسخه، پکیج"})</span>
              </label>
            </div>
          </div>

          <!-- Step 3: Basic Details -->
          <div class="form-section">
            <div class="form-row-2">
              <div class="form-group">
                <label for="prod-title" class="field-label">نام محصول <span class="required">*</span></label>
                <input type="text" id="prod-title" class="field-input" placeholder="${isPhysical ? "مثلاً: تیشرت ورزشی مردانه" : "مثلاً: دوره جامع آموزش اکسل"}" required />
              </div>
              <div class="form-group">
                <label for="prod-category" class="field-label">دسته‌بندی</label>
                <input type="text" id="prod-category" class="field-input" placeholder="${isPhysical ? "پوشاک، کالای دیجیتال، ..." : "آموزش، نرم‌افزار، گرافیک، ..."}" />
              </div>
            </div>

            <div class="form-group">
              <label for="prod-desc" class="field-label">توضیح کوتاه</label>
              <textarea id="prod-desc" class="field-textarea" rows="2" placeholder="ویژگی‌های برجسته محصول را برای مشتریان بنویسید..."></textarea>
            </div>
          </div>

          <!-- Digital File Upload Zone (Visible only for digital) -->
          ${isDigital ? `
            <div class="form-section digital-upload-section">
              <label class="form-section-label">فایل محصول دیجیتال</label>
              <div class="digital-dropzone ${this.uploadedFileName ? "has-file" : ""}" id="digital-file-dropzone">
                <input type="file" id="digital-file-input" class="sr-only" />
                <div class="dropzone-content">
                  <span class="dropzone-icon">📁</span>
                  <strong>${this.uploadedFileName ? this.uploadedFileName : "فایل محصول را اینجا قرار دهید یا انتخاب کنید"}</strong>
                  <small>${this.uploadedFileSize ? `حجم: ${this.uploadedFileSize}` : "پشتیبانی از ZIP, PDF, MP4, MP3, PSD و تمام فایل‌های دانلودی (تحویل امن پس از خرید)"}</small>
                  ${this.uploadedFileName ? '<button type="button" class="button button-ghost button-xs" id="remove-file-btn">حذف فایل</button>' : ""}
                </div>
              </div>
              <div class="form-row-2" style="margin-top: 10px;">
                <div class="form-group">
                  <label for="digital-version" class="field-label">نسخه فایل (اختیاری)</label>
                  <input type="text" id="digital-version" class="field-input" placeholder="مثلاً: 1.0 یا بهار ۱۴۰۵" />
                </div>
                <div class="form-group">
                  <label for="digital-access-duration" class="field-label">دسترسی دانلود</label>
                  <select id="digital-access-duration" class="field-select">
                    <option value="unlimited">دائمی و نامحدود (پیشنهادی)</option>
                    <option value="30">۳۰ روز پس از خرید</option>
                    <option value="90">۹۰ روز پس از خرید</option>
                    <option value="365">یک سال پس از خرید</option>
                  </select>
                </div>
              </div>
            </div>
          ` : ""}

          <!-- Step 4: Variable Matrix Setup (Visible only if variable) -->
          ${isVariable ? `
            <div class="form-section variable-matrix-section">
              <label class="form-section-label">مشخصات تنوع‌ها</label>
              <p class="form-section-desc">ویژگی‌ها را بنویسید؛ ققنوس مدل‌ها را به طور خودکار ترکیب می‌کند.</p>

              <div class="attributes-setup-grid">
                <div class="attribute-box">
                  <div class="attribute-head">
                    <input type="text" class="field-input attr-name-input" id="attr-1-name" value="${this.option1Name}" placeholder="نام ویژگی (مثلاً: ${isPhysical ? "رنگ" : "فرمت"})" />
                  </div>
                  <div class="attribute-values-wrap">
                    <label class="field-label">مقادیر (با کاما یا اینتر جدا کنید)</label>
                    <input type="text" class="field-input attr-values-input" id="attr-1-values" value="${this.option1Values.join(", ")}" placeholder="${isPhysical ? "مشکی, سفید, سرمه‌ای" : "PDF, ویدیویی, سورس کامل"}" />
                  </div>
                </div>

                <div class="attribute-box">
                  <div class="attribute-head">
                    <input type="text" class="field-input attr-name-input" id="attr-2-name" value="${this.option2Name}" placeholder="نام ویژگی دوم (مثلاً: ${isPhysical ? "سایز" : "نوع لایسنس"})" />
                  </div>
                  <div class="attribute-values-wrap">
                    <label class="field-label">مقادیر ویژگی دوم</label>
                    <input type="text" class="field-input attr-values-input" id="attr-2-values" value="${this.option2Values.join(", ")}" placeholder="${isPhysical ? "M, L, XL" : "تک‌کاربره, تیمی"}" />
                  </div>
                </div>
              </div>

              <!-- Generated Variants Preview Table -->
              <div class="variants-table-wrap">
                <table class="variants-table">
                  <thead>
                    <tr>
                      <th>مدل</th>
                      <th>قیمت مصرف‌کننده (تومان)</th>
                      <th>قیمت همکار</th>
                      <th>قیمت نماینده</th>
                      ${isPhysical ? "<th>موجودی</th>" : ""}
                    </tr>
                  </thead>
                  <tbody id="variants-table-body">
                    ${this.renderVariantRowsHtml()}
                  </tbody>
                </table>
              </div>
            </div>
          ` : `
            <!-- Simple Product Pricing & Inventory -->
            <div class="form-section simple-pricing-section">
              <label class="form-section-label">قیمت‌گذاری و عرضه به چه کسانی؟</label>
              <p class="form-section-desc">تیک هر گروه به معنی اجازه خرید آن گروه با قیمت تعیین‌شده است.</p>

              <div class="offer-matrix-simple">
                <div class="offer-row">
                  <label class="offer-check-label">
                    <input type="checkbox" id="chk-consumer" checked />
                    <strong>مصرف‌کننده عادی</strong>
                  </label>
                  <div class="offer-input-wrap">
                    <input type="number" id="price-consumer" class="field-input" placeholder="۲,۵۰۰,۰۰۰" />
                    <span class="currency-tag">تومان</span>
                  </div>
                </div>

                <div class="offer-row">
                  <label class="offer-check-label">
                    <input type="checkbox" id="chk-partner" checked />
                    <strong>همکار تجاری</strong>
                  </label>
                  <div class="offer-input-wrap">
                    <input type="number" id="price-partner" class="field-input" placeholder="۲,۱۵۰,۰۰۰" />
                    <span class="currency-tag">تومان</span>
                  </div>
                </div>

                <div class="offer-row">
                  <label class="offer-check-label">
                    <input type="checkbox" id="chk-agent" />
                    <strong>نماینده رسمی</strong>
                  </label>
                  <div class="offer-input-wrap">
                    <input type="number" id="price-agent" class="field-input" placeholder="۲,۰۰۰,۰۰۰" />
                    <span class="currency-tag">تومان</span>
                  </div>
                </div>
              </div>

              ${isPhysical ? `
                <div class="form-row-2" style="margin-top: 15px;">
                  <div class="form-group">
                    <label for="prod-stock" class="field-label">موجودی انبار</label>
                    <input type="number" id="prod-stock" class="field-input" value="10" min="0" />
                  </div>
                  <div class="form-group">
                    <label for="prod-weight" class="field-label">وزن تخمینی (گرم) جهت محاسبه ارسال</label>
                    <input type="number" id="prod-weight" class="field-input" placeholder="مثلاً: 350" />
                  </div>
                </div>
              ` : ""}
            </div>
          `}

          <!-- Actions Footer -->
          <div class="product-form-actions">
            <button type="button" class="button button-ghost" id="cancel-product-btn">انصراف</button>
            <button type="submit" class="button button-primary" id="save-product-btn">
              <span>ذخیره و انتشار محصول</span>
              <i>✓</i>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  private renderVariantRowsHtml(): string {
    const rows = this.generateVariantRows(1000000);
    return rows
      .map(
        (row) => `
        <tr data-variant-id="${row.id}">
          <td><strong>${row.name}</strong></td>
          <td><input type="number" class="table-input" value="${row.priceConsumer}" /></td>
          <td><input type="number" class="table-input" value="${row.pricePartner ?? ""}" placeholder="ارث‌بری" /></td>
          <td><input type="number" class="table-input" value="${row.priceAgent ?? ""}" placeholder="ارث‌بری" /></td>
          ${this.nature === "physical" ? `<td><input type="number" class="table-input stock-input" value="${row.stock ?? 10}" /></td>` : ""}
        </tr>
      `,
      )
      .join("");
  }

  /**
   * Binds interaction events to DOM elements
   */
  bindEvents(container: HTMLElement): void {
    // 1. Nature toggle (Physical vs Digital)
    container.querySelectorAll<HTMLButtonElement>(".nature-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const selected = btn.dataset.nature as ProductNature;
        if (selected && selected !== this.nature) {
          this.nature = selected;
          this.reRender(container);
        }
      });
    });

    // 2. Structure radio change (Simple vs Variable)
    container.querySelectorAll<HTMLInputElement>('input[name="product_structure"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const val = radio.value as ProductStructure;
        if (val !== this.structure) {
          this.structure = val;
          this.reRender(container);
        }
      });
    });

    // 3. Dropzone file selection
    const dropzone = container.querySelector<HTMLElement>("#digital-file-dropzone");
    const fileInput = container.querySelector<HTMLInputElement>("#digital-file-input");
    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => {
        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          this.uploadedFileName = file.name;
          const mb = (file.size / (1024 * 1024)).toFixed(1);
          this.uploadedFileSize = `${mb} مگابایت`;
          this.reRender(container);
        }
      });
    }

    // 4. Remove file button
    const removeFileBtn = container.querySelector<HTMLButtonElement>("#remove-file-btn");
    if (removeFileBtn) {
      removeFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.uploadedFileName = null;
        this.uploadedFileSize = null;
        this.reRender(container);
      });
    }

    // 5. Cancel button
    const cancelBtn = container.querySelector<HTMLButtonElement>("#cancel-product-btn");
    if (cancelBtn && this.options.onCancel) {
      cancelBtn.addEventListener("click", () => this.options.onCancel!());
    }

    // 6. Save button
    const form = container.querySelector<HTMLFormElement>("#product-form-element");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const data = this.extractFormData(container);
        if (this.options.onSave) {
          void this.options.onSave(data);
        }
      });
    }
  }

  private extractFormData(container: HTMLElement): NewProductFormData {
    const titleInput = container.querySelector<HTMLInputElement>("#prod-title");
    const descInput = container.querySelector<HTMLTextAreaElement>("#prod-desc");
    const title = titleInput?.value.trim() || "محصول جدید";
    const description = descInput?.value.trim() || "";

    const priceConsumer = Number(container.querySelector<HTMLInputElement>("#price-consumer")?.value || 0);
    const pricePartnerVal = container.querySelector<HTMLInputElement>("#price-partner")?.value;
    const pricePartner = pricePartnerVal ? Number(pricePartnerVal) : undefined;
    const priceAgentVal = container.querySelector<HTMLInputElement>("#price-agent")?.value;
    const priceAgent = priceAgentVal ? Number(priceAgentVal) : undefined;

    const availableConsumer = container.querySelector<HTMLInputElement>("#chk-consumer")?.checked ?? true;
    const availablePartner = container.querySelector<HTMLInputElement>("#chk-partner")?.checked ?? true;
    const availableAgent = container.querySelector<HTMLInputElement>("#chk-agent")?.checked ?? false;

    const stock = Number(container.querySelector<HTMLInputElement>("#prod-stock")?.value || 0);
    const weight = Number(container.querySelector<HTMLInputElement>("#prod-weight")?.value || 0);

    return {
      nature: this.nature,
      structure: this.structure,
      title,
      description,
      basePriceConsumer: priceConsumer,
      basePricePartner: pricePartner,
      basePriceAgent: priceAgent,
      availableConsumer,
      availablePartner,
      availableAgent,
      stockQuantity: this.nature === "physical" ? stock : undefined,
      weightGrams: this.nature === "physical" ? weight : undefined,
      digitalFile: this.uploadedFileName
        ? {
            name: this.uploadedFileName,
            sizeBytes: 1024 * 1024,
            mimeType: "application/octet-stream",
          }
        : undefined,
      variants: this.structure === "variable" ? this.generateVariantRows(priceConsumer || 1000000) : undefined,
    };
  }

  private reRender(container: HTMLElement): void {
    container.innerHTML = this.render();
    this.bindEvents(container);
  }
}
