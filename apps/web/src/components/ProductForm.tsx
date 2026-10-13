import React, { useState, useId, useRef } from "react";
import { z } from "zod";

export type ProductNature = "physical" | "digital";
export type ProductStructure = "simple" | "variable";

/**
 * Zod Schemas for Product Creation Validation
 */
export const ProductStep2Schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "لطفاً نام محصول را وارد کنید." })
    .min(3, { message: "نام محصول باید حداقل ۳ کاراکتر باشد." }),
  category: z
    .string()
    .trim()
    .min(1, { message: "لطفاً دسته‌بندی محصول را مشخص کنید." }),
  description: z.string().optional(),
});

export const ProductStep3Schema = z.object({
  nature: z.enum(["physical", "digital"]),
  structure: z.enum(["simple", "variable"]),
  basePriceConsumer: z
    .number({ message: "لطفاً مبلغ معتبر برای قیمت مصرف‌کننده وارد کنید." })
    .positive({ message: "قیمت مصرف‌کننده باید بیشتر از صفر باشد." }),
  basePricePartner: z.number().positive({ message: "قیمت همکار باید بیشتر از صفر باشد." }).optional(),
  basePriceAgent: z.number().positive({ message: "قیمت نماینده باید بیشتر از صفر باشد." }).optional(),
  stockQuantity: z
    .number({ message: "موجودی انبار باید عدد باشد." })
    .min(0, { message: "موجودی انبار نمی‌تواند منفی باشد." })
    .optional(),
  weightGrams: z
    .number({ message: "وزن باید عدد باشد." })
    .min(0, { message: "وزن نمی‌تواند منفی باشد." })
    .optional(),
});

export interface UploadedFileAsset {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly type: string;
  readonly category: "image" | "digital_asset" | "document";
}

export interface GeneratedVariantRow {
  readonly id: string;
  readonly name: string;
  readonly attributes: Record<string, string>;
  priceConsumer: number;
  pricePartner?: number | undefined;
  priceAgent?: number | undefined;
  stock?: number | undefined;
}

export interface ProductFormData {
  readonly nature: ProductNature;
  readonly structure: ProductStructure;
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly basePriceConsumer: number;
  readonly basePricePartner?: number | undefined;
  readonly basePriceAgent?: number | undefined;
  readonly availableConsumer: boolean;
  readonly availablePartner: boolean;
  readonly availableAgent: boolean;
  readonly stockQuantity?: number | undefined;
  readonly weightGrams?: number | undefined;
  readonly digitalAccessDurationDays?: number | null | undefined;
  readonly files: readonly UploadedFileAsset[];
  readonly variants?: readonly GeneratedVariantRow[] | undefined;
}

export interface ProductFormProps {
  readonly onSave?: (data: ProductFormData) => void | Promise<void>;
  readonly onCancel?: () => void;
  readonly initialData?: Partial<ProductFormData> | undefined;
}

export const ProductForm: React.FC<ProductFormProps> = ({ onSave, onCancel, initialData }) => {
  // Step state (Multi-step form: 1 = Nature & Structure, 2 = Details & Media, 3 = Pricing & Variants)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [nature, setNature] = useState<ProductNature>(initialData?.nature ?? "physical");
  const [structure, setStructure] = useState<ProductStructure>(initialData?.structure ?? "simple");

  const [title, setTitle] = useState<string>(initialData?.title ?? "");
  const [category, setCategory] = useState<string>(initialData?.category ?? "");
  const [description, setDescription] = useState<string>(initialData?.description ?? "");

  // Pricing State
  const [basePriceConsumer, setBasePriceConsumer] = useState<string>(
    initialData?.basePriceConsumer ? String(initialData.basePriceConsumer) : "",
  );
  const [basePricePartner, setBasePricePartner] = useState<string>(
    initialData?.basePricePartner ? String(initialData.basePricePartner) : "",
  );
  const [basePriceAgent, setBasePriceAgent] = useState<string>(
    initialData?.basePriceAgent ? String(initialData.basePriceAgent) : "",
  );

  const [availableConsumer, setAvailableConsumer] = useState<boolean>(initialData?.availableConsumer ?? true);
  const [availablePartner, setAvailablePartner] = useState<boolean>(initialData?.availablePartner ?? true);
  const [availableAgent, setAvailableAgent] = useState<boolean>(initialData?.availableAgent ?? false);

  // Physical State
  const [stockQuantity, setStockQuantity] = useState<string>(
    initialData?.stockQuantity ? String(initialData.stockQuantity) : "10",
  );
  const [weightGrams, setWeightGrams] = useState<string>(
    initialData?.weightGrams ? String(initialData.weightGrams) : "",
  );

  // Digital State
  const [accessDuration, setAccessDuration] = useState<string>("unlimited");

  // Dynamic Variable Options
  const [option1Name, setOption1Name] = useState<string>("رنگ");
  const [option1Values, setOption1Values] = useState<string>("مشکی, سفید");
  const [option2Name, setOption2Name] = useState<string>("سایز");
  const [option2Values, setOption2Values] = useState<string>("M, L");

  // Files State (Shielded from technical file system paths)
  const [files, setFiles] = useState<UploadedFileAsset[]>(
    initialData?.files ? [...initialData.files] : [],
  );

  // Errors State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const titleId = useId();
  const categoryId = useId();
  const descId = useId();
  const priceConsumerId = useId();

  // Helper to generate dynamic combinations
  const computeVariantRows = (): GeneratedVariantRow[] => {
    const pConsumer = Number(basePriceConsumer) || 1000000;
    const pPartner = basePricePartner ? Number(basePricePartner) : Math.round(pConsumer * 0.9);
    const pAgent = basePriceAgent ? Number(basePriceAgent) : Math.round(pConsumer * 0.8);

    const vals1 = option1Name.trim()
      ? option1Values
          .split(/[,،]+/)
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const vals2 = option2Name.trim()
      ? option2Values
          .split(/[,،]+/)
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

    if (vals1.length === 0 && vals2.length === 0) {
      return [];
    }

    if (vals2.length === 0) {
      return vals1.map((v1) => ({
        id: `var-${v1}`,
        name: v1,
        attributes: { [option1Name]: v1 },
        priceConsumer: pConsumer,
        pricePartner: pPartner,
        priceAgent: pAgent,
        stock: 10,
      }));
    }

    if (vals1.length === 0) {
      return vals2.map((v2) => ({
        id: `var-${v2}`,
        name: v2,
        attributes: { [option2Name]: v2 },
        priceConsumer: pConsumer,
        pricePartner: pPartner,
        priceAgent: pAgent,
        stock: 10,
      }));
    }

    const rows: GeneratedVariantRow[] = [];
    for (const v1 of vals1) {
      for (const v2 of vals2) {
        rows.push({
          id: `var-${v1}-${v2}`,
          name: `${v1} / ${v2}`,
          attributes: { [option1Name]: v1, [option2Name]: v2 },
          priceConsumer: pConsumer,
          pricePartner: pPartner,
          priceAgent: pAgent,
          stock: 10,
        });
      }
    }
    return rows;
  };

  const [customVariantPrices, setCustomVariantPrices] = useState<Record<string, number>>({});

  // File Upload Handlers (Shields vendor from OS paths; stores only client-safe metadata)
  const handleIncomingFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newAssets: UploadedFileAsset[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;

      let category: "image" | "digital_asset" | "document" = "document";
      if (file.type.startsWith("image/")) {
        category = "image";
      } else if (
        file.type.includes("zip") ||
        file.type.includes("rar") ||
        file.type.includes("octet-stream") ||
        file.type.includes("audio") ||
        file.type.includes("video")
      ) {
        category = "digital_asset";
      }

      newAssets.push({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sizeBytes: file.size,
        type: file.type || "application/octet-stream",
        category,
      });
    }

    setFiles((prev) => [...prev, ...newAssets]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} بایت`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
  };

  // Step Validation Logic using Zod schemas
  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 2) {
      const result = ProductStep2Schema.safeParse({
        title,
        category,
        description,
      });

      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0];
          if (typeof field === "string" && !errs[field]) {
            errs[field] = issue.message;
          }
        }
      }
    }

    if (step === 3) {
      const parsedPrice = basePriceConsumer.trim() === "" ? NaN : Number(basePriceConsumer);
      const parsedPartner = basePricePartner.trim() === "" ? undefined : Number(basePricePartner);
      const parsedAgent = basePriceAgent.trim() === "" ? undefined : Number(basePriceAgent);
      const parsedStock = nature === "physical" && structure === "simple"
        ? (stockQuantity.trim() === "" ? NaN : Number(stockQuantity))
        : undefined;
      const parsedWeight = nature === "physical" && weightGrams.trim() !== ""
        ? Number(weightGrams)
        : undefined;

      const result = ProductStep3Schema.safeParse({
        nature,
        structure,
        basePriceConsumer: parsedPrice,
        basePricePartner: parsedPartner,
        basePriceAgent: parsedAgent,
        stockQuantity: parsedStock,
        weightGrams: parsedWeight,
      });

      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0];
          if (field === "basePriceConsumer") {
            errs.price = issue.message;
          } else if (field === "stockQuantity") {
            errs.stock = issue.message;
          } else if (typeof field === "string" && !errs[field]) {
            errs[field] = issue.message;
          }
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrors({});
      setCurrentStep((prev) => Math.min(3, prev + 1));
    }
  };

  const handlePrev = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isStep2Valid = validateStep(2);
    const isStep3Valid = validateStep(3);

    if (!isStep2Valid) {
      setCurrentStep(2);
      return;
    }

    if (!isStep3Valid) {
      setCurrentStep(3);
      return;
    }

    const rows = structure === "variable" ? computeVariantRows() : undefined;
    const finalVariants = rows?.map((r) => ({
      ...r,
      priceConsumer: customVariantPrices[r.id] ?? r.priceConsumer,
    }));

    const payload: ProductFormData = {
      nature,
      structure,
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      basePriceConsumer: Number(basePriceConsumer),
      basePricePartner: basePricePartner ? Number(basePricePartner) : undefined,
      basePriceAgent: basePriceAgent ? Number(basePriceAgent) : undefined,
      availableConsumer,
      availablePartner,
      availableAgent,
      stockQuantity: nature === "physical" ? Number(stockQuantity) : undefined,
      weightGrams: nature === "physical" && weightGrams ? Number(weightGrams) : undefined,
      digitalAccessDurationDays: accessDuration === "unlimited" ? null : Number(accessDuration),
      files,
      variants: finalVariants,
    };

    if (onSave) {
      void onSave(payload);
    }
  };

  const variantRows = structure === "variable" ? computeVariantRows() : [];

  return (
    <div className="product-create-form glass-card" style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* Header and Step Indicator */}
      <div className="product-form-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="eyebrow">
              <i></i> مرحله {currentStep} از ۳ · {nature === "physical" ? "کالای فیزیکی" : "محصول دیجیتال"}
            </span>
            <h2 style={{ margin: "4px 0" }}>افزودن محصول جدید</h2>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span className={`pill ${currentStep === 1 ? "primary" : "ghost"}`}>۱. نوع محصول</span>
            <span className={`pill ${currentStep === 2 ? "primary" : "ghost"}`}>۲. اطلاعات و فایل‌ها</span>
            <span className={`pill ${currentStep === 3 ? "primary" : "ghost"}`}>۳. قیمت و عرضه</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* ================================================================= */}
        {/* STEP 1: NATURE & STRUCTURE CHOICE                                 */}
        {/* ================================================================= */}
        {currentStep === 1 && (
          <div>
            <div className="form-section">
              <label className="form-section-label">چه چیزی می‌خواهید اضافه کنید؟</label>
              <div className="nature-toggle-grid">
                <button
                  type="button"
                  className={`nature-card ${nature === "physical" ? "active" : ""}`}
                  onClick={() => setNature("physical")}
                >
                  <span className="nature-icon">📦</span>
                  <strong>کالا</strong>
                  <small>محصول فیزیکی نیازمند انبار و ارسال پستی</small>
                </button>
                <button
                  type="button"
                  className={`nature-card ${nature === "digital" ? "active" : ""}`}
                  onClick={() => setNature("digital")}
                >
                  <span className="nature-icon">⚡</span>
                  <strong>محصول دیجیتال</strong>
                  <small>فایل دانلودی، دوره، قالب یا محتوا بدون نیاز به ارسال</small>
                </button>
              </div>
            </div>

            <div className="form-section">
              <label className="form-section-label">این محصول چند مدل یا نوع دارد؟</label>
              <div className="structure-toggle-row">
                <label className={`choice-pill ${structure === "simple" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="structure_radio"
                    checked={structure === "simple"}
                    onChange={() => setStructure("simple")}
                  />
                  <span>یک نوع (ساده)</span>
                </label>
                <label className={`choice-pill ${structure === "variable" ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="structure_radio"
                    checked={structure === "variable"}
                    onChange={() => setStructure("variable")}
                  />
                  <span>چند نوع ({nature === "physical" ? "رنگ، سایز، مدل" : "فرمت، نسخه، پکیج"})</span>
                </label>
              </div>
            </div>

            <div className="product-form-actions">
              {onCancel && (
                <button type="button" className="button button-ghost" onClick={onCancel}>
                  انصراف
                </button>
              )}
              <button type="button" className="button button-primary" onClick={handleNext}>
                مرحله بعد: اطلاعات محصول <span>←</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: BASIC DETAILS & FILE UPLOAD DROPZONE                     */}
        {/* ================================================================= */}
        {currentStep === 2 && (
          <div>
            <div className="form-section">
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor={titleId} className="field-label">
                    نام محصول <span className="required" style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    id={titleId}
                    type="text"
                    className="field-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={nature === "physical" ? "مثلاً: تیشرت ورزشی مردانه" : "مثلاً: دوره جامع آموزش اکسل"}
                  />
                  {errors.title && <span style={{ color: "var(--danger)", fontSize: 12 }}>{errors.title}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor={categoryId} className="field-label">
                    دسته‌بندی <span className="required" style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input
                    id={categoryId}
                    type="text"
                    className="field-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={nature === "physical" ? "پوشاک، کالای دیجیتال، ..." : "آموزش، نرم‌افزار، گرافیک، ..."}
                  />
                  {errors.category && <span style={{ color: "var(--danger)", fontSize: 12 }}>{errors.category}</span>}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label htmlFor={descId} className="field-label">توضیح کوتاه</label>
                <textarea
                  id={descId}
                  className="field-textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ویژگی‌های برجسته محصول را برای مشتریان بنویسید..."
                />
              </div>
            </div>

            {/* Dropzone for Product Images & Digital Assets */}
            <div className="form-section">
              <label className="form-section-label">
                {nature === "digital" ? "تصاویر و فایل‌های محصول دیجیتال" : "تصاویر محصول"}
              </label>
              <p className="form-section-desc">
                فایل‌ها را به سادگی اینجا رها کنید؛ تحویل امن، تشخیص نوع و نگهداری توسط سیستم مدیریت می‌شود.
              </p>

              <div
                className={`digital-dropzone ${isDragOver ? "has-file" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleIncomingFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={(e) => handleIncomingFiles(e.target.files)}
                />
                <div className="dropzone-content">
                  <span className="dropzone-icon">📁</span>
                  <strong>فایل‌ها یا عکس‌های محصول را اینجا بکشید یا انتخاب کنید</strong>
                  <small>
                    پشتیبانی از انواع تصاویر (JPG, PNG, WebP) و فایل‌های دیجیتال (ZIP, PDF, MP4, PSD و ...)
                  </small>
                </div>
              </div>

              {/* Uploaded Files List */}
              {files.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <label className="field-label">فایل‌های پیوست‌شده ({files.length}):</label>
                  {files.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 14px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span>{file.category === "image" ? "🖼️" : file.category === "digital_asset" ? "⚡" : "📄"}</span>
                        <div>
                          <strong style={{ fontSize: 13, display: "block" }}>{file.name}</strong>
                          <small style={{ color: "var(--muted)", fontSize: 11 }}>
                            {formatFileSize(file.sizeBytes)} · {file.category === "image" ? "تصویر محصول" : "فایل دانلودی"}
                          </small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button button-ghost button-xs"
                        style={{ color: "var(--danger)" }}
                        onClick={() => removeFile(file.id)}
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {nature === "digital" && (
                <div className="form-group" style={{ marginTop: 14 }}>
                  <label htmlFor="digital-access-duration" className="field-label">دسترسی دانلود مشتری</label>
                  <select
                    id="digital-access-duration"
                    className="field-select"
                    value={accessDuration}
                    onChange={(e) => setAccessDuration(e.target.value)}
                  >
                    <option value="unlimited">دائمی و همیشگی (پیشنهادی)</option>
                    <option value="30">۳۰ روز پس از خرید</option>
                    <option value="90">۹۰ روز پس از خرید</option>
                    <option value="365">یک سال پس از خرید</option>
                  </select>
                </div>
              )}
            </div>

            <div className="product-form-actions">
              <button type="button" className="button button-ghost" onClick={handlePrev}>
                <span>→</span> مرحله قبل
              </button>
              <button type="button" className="button button-primary" onClick={handleNext}>
                مرحله بعد: قیمت و عرضه <span>←</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: PRICING, AUDIENCE & VARIABLE MATRIX                      */}
        {/* ================================================================= */}
        {currentStep === 3 && (
          <div>
            {/* Variable Attributes Definition */}
            {structure === "variable" && (
              <div className="form-section">
                <label className="form-section-label">مشخصات تنوع‌ها (مدل‌ها)</label>
                <p className="form-section-desc">
                  ویژگی‌ها را بنویسید؛ سیستم به صورت خودکار ترکیب‌ها را در جدول زیر ایجاد می‌کند.
                </p>

                <div className="attributes-setup-grid">
                  <div className="attribute-box">
                    <label className="field-label">نام ویژگی اول</label>
                    <input
                      type="text"
                      className="field-input"
                      value={option1Name}
                      onChange={(e) => setOption1Name(e.target.value)}
                      placeholder="مثلاً: رنگ یا فرمت"
                    />
                    <label className="field-label" style={{ marginTop: 8 }}>مقادیر (با کاما جدا کنید)</label>
                    <input
                      type="text"
                      className="field-input"
                      value={option1Values}
                      onChange={(e) => setOption1Values(e.target.value)}
                      placeholder="مشکی, سفید, آبی"
                    />
                  </div>

                  <div className="attribute-box">
                    <label className="field-label">نام ویژگی دوم (اختیاری)</label>
                    <input
                      type="text"
                      className="field-input"
                      value={option2Name}
                      onChange={(e) => setOption2Name(e.target.value)}
                      placeholder="مثلاً: سایز یا حجم"
                    />
                    <label className="field-label" style={{ marginTop: 8 }}>مقادیر ویژگی دوم</label>
                    <input
                      type="text"
                      className="field-input"
                      value={option2Values}
                      onChange={(e) => setOption2Values(e.target.value)}
                      placeholder="M, L, XL"
                    />
                  </div>
                </div>

                {/* Dynamic Data Table for Variants */}
                {variantRows.length > 0 && (
                  <div className="variants-table-wrap">
                    <table className="variants-table">
                      <thead>
                        <tr>
                          <th>مدل / ترکیب</th>
                          <th>قیمت مصرف‌کننده (تومان)</th>
                          <th>قیمت همکار</th>
                          <th>قیمت نماینده</th>
                          {nature === "physical" && <th>موجودی</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {variantRows.map((row) => (
                          <tr key={row.id}>
                            <td><strong>{row.name}</strong></td>
                            <td>
                              <input
                                type="number"
                                className="table-input"
                                value={customVariantPrices[row.id] ?? row.priceConsumer}
                                onChange={(e) =>
                                  setCustomVariantPrices((prev) => ({
                                    ...prev,
                                    [row.id]: Number(e.target.value),
                                  }))
                                }
                              />
                            </td>
                            <td>
                              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                                {row.pricePartner?.toLocaleString("fa-IR")} تومان
                              </span>
                            </td>
                            <td>
                              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                                {row.priceAgent?.toLocaleString("fa-IR")} تومان
                              </span>
                            </td>
                            {nature === "physical" && (
                              <td>
                                <input
                                  type="number"
                                  className="table-input"
                                  defaultValue={row.stock ?? 10}
                                  style={{ width: 70 }}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Base Offer Matrix (Audience & Price) */}
            <div className="form-section">
              <label className="form-section-label">قیمت پایه و عرضه به چه کسانی؟</label>
              <p className="form-section-desc">
                تیک هر گروه مشخص می‌کند آیا محصول برای آن گروه عرضه می‌شود و با چه قیمتی.
              </p>

              <div className="offer-matrix-simple">
                <div className="offer-row">
                  <label className="offer-check-label">
                    <input
                      type="checkbox"
                      checked={availableConsumer}
                      onChange={(e) => setAvailableConsumer(e.target.checked)}
                    />
                    <strong>مصرف‌کننده عادی <span className="required" style={{ color: "var(--danger)" }}>*</span></strong>
                  </label>
                  <div className="offer-input-wrap">
                    <input
                      id={priceConsumerId}
                      type="number"
                      className="field-input"
                      placeholder="۲,۵۰۰,۰۰۰"
                      value={basePriceConsumer}
                      onChange={(e) => setBasePriceConsumer(e.target.value)}
                    />
                    <span className="currency-tag">تومان</span>
                  </div>
                </div>

                <div className="offer-row">
                  <label className="offer-check-label">
                    <input
                      type="checkbox"
                      checked={availablePartner}
                      onChange={(e) => setAvailablePartner(e.target.checked)}
                    />
                    <strong>همکار تجاری</strong>
                  </label>
                  <div className="offer-input-wrap">
                    <input
                      type="number"
                      className="field-input"
                      placeholder="۲,۱۵۰,۰۰۰"
                      value={basePricePartner}
                      onChange={(e) => setBasePricePartner(e.target.value)}
                    />
                    <span className="currency-tag">تومان</span>
                  </div>
                </div>

                <div className="offer-row">
                  <label className="offer-check-label">
                    <input
                      type="checkbox"
                      checked={availableAgent}
                      onChange={(e) => setAvailableAgent(e.target.checked)}
                    />
                    <strong>نماینده رسمی</strong>
                  </label>
                  <div className="offer-input-wrap">
                    <input
                      type="number"
                      className="field-input"
                      placeholder="۲,۰۰۰,۰۰۰"
                      value={basePriceAgent}
                      onChange={(e) => setBasePriceAgent(e.target.value)}
                    />
                    <span className="currency-tag">تومان</span>
                  </div>
                </div>
              </div>
              {errors.price && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{errors.price}</p>}
            </div>

            {nature === "physical" && structure === "simple" && (
              <div className="form-section">
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="prod-stock-input" className="field-label">موجودی اولیه انبار</label>
                    <input
                      id="prod-stock-input"
                      type="number"
                      className="field-input"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                    />
                    {errors.stock && <span style={{ color: "var(--danger)", fontSize: 12 }}>{errors.stock}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="prod-weight-input" className="field-label">وزن تخمینی (گرم)</label>
                    <input
                      id="prod-weight-input"
                      type="number"
                      className="field-input"
                      value={weightGrams}
                      onChange={(e) => setWeightGrams(e.target.value)}
                      placeholder="مثلاً: ۳۵۰"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="product-form-actions">
              <button type="button" className="button button-ghost" onClick={handlePrev}>
                <span>→</span> مرحله قبل
              </button>
              <button type="submit" className="button button-primary">
                <span>ذخیره و انتشار محصول</span>
                <i>✓</i>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
