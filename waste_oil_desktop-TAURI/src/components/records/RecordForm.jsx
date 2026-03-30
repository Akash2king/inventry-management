import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SearchableVendorSelect } from "@/components/records/SearchableVendorSelect.jsx";

const schema = z.object({
  vendor_id: z.string().uuid("Select a vendor"),
  product_description: z.union([z.string(), z.literal("")]).optional(),
  product_type: z.string().min(1, "Required"),
  unit: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be positive"),
  entry_date: z.string().min(1, "Required"),
  due_date: z.union([z.string(), z.literal("")]).optional(),
  remarks: z.union([z.string(), z.literal("")]).optional(),
});

export function RecordForm({
  vendors = [],
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  isSubmitting = false,
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      vendor_id: "",
      product_description: "",
      product_type: "",
      unit: "",
      quantity: "",
      entry_date: "",
      due_date: "",
      remarks: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid-form">
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label htmlFor="vendor_id">Vendor</label>
        <Controller
          name="vendor_id"
          control={control}
          render={({ field }) => (
            <SearchableVendorSelect
              id="vendor_id"
              vendors={vendors}
              value={field.value}
              onChange={field.onChange}
              disabled={vendors.length === 0}
              error={Boolean(errors.vendor_id)}
            />
          )}
        />
        {errors.vendor_id ? (
          <div className="field-error">{errors.vendor_id.message}</div>
        ) : null}
        {vendors.length === 0 ? (
          <p style={{ fontSize: "0.85rem", marginTop: 6, opacity: 0.9 }}>
            No vendors yet. Open <strong>Vendors</strong> in the sidebar and add one first.
          </p>
        ) : null}
      </div>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label htmlFor="product_description">Product description</label>
        <textarea id="product_description" rows={2} {...register("product_description")} />
        {errors.product_description ? (
          <div className="field-error">{errors.product_description.message}</div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="product_type">Product type</label>
        <input id="product_type" {...register("product_type")} placeholder="e.g. scrap, chemical, consumable" />
        {errors.product_type ? (
          <div className="field-error">{errors.product_type.message}</div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="unit">Unit</label>
        <input id="unit" {...register("unit")} placeholder="kg, L, pcs…" />
        {errors.unit ? <div className="field-error">{errors.unit.message}</div> : null}
      </div>
      <div className="field">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          step="any"
          {...register("quantity")}
        />
        {errors.quantity ? (
          <div className="field-error">{errors.quantity.message}</div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="entry_date">Entry date</label>
        <input id="entry_date" type="date" {...register("entry_date")} />
        {errors.entry_date ? (
          <div className="field-error">{errors.entry_date.message}</div>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="due_date">Due date</label>
        <input id="due_date" type="date" {...register("due_date")} />
        <span style={{ fontSize: "0.8rem", opacity: 0.8, display: "block", marginTop: 4 }}>
          Leave blank to use system SLA from entry date.
        </span>
        {errors.due_date ? (
          <div className="field-error">{errors.due_date.message}</div>
        ) : null}
      </div>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label htmlFor="remarks">Remarks</label>
        <textarea id="remarks" rows={3} {...register("remarks")} />
        {errors.remarks ? (
          <div className="field-error">{errors.remarks.message}</div>
        ) : null}
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem" }}>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting || vendors.length === 0}>
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
