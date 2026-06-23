import { useEffect, useMemo, useState } from "react";
import {
  getActiveSalePrice,
  getActiveSalePricingTiers,
  getBasePricingTiers,
  getEffectiveLotPricing,
  getParkingLot,
  getPricingTierLabel,
  getSalePricingTiers,
  setLotPricing,
  type ParkingLotDoc,
  type ParkingLotPricingPatch,
  type ParkingPriceTier,
  type PricingDurationUnit,
} from "../../services/parkingLots.service";
import "./OwnerPricingPopup.css";

type EditablePricingTier = {
  id: string;
  price: string;
  durationUnit: PricingDurationUnit;
  durationValue: string;
};

type OwnerPricingLot = {
  id: string;
  name: string;
  address: string;
  basePrice: number;
  basePricingTiers?: ParkingPriceTier[];
  basePriceDurationUnit?: PricingDurationUnit;
  basePriceDurationValue?: number;
  salePrice?: number | null;
  salePricingTiers?: ParkingPriceTier[] | null;
  salePriceDurationUnit?: PricingDurationUnit | null;
  salePriceDurationValue?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  activeSalePrice?: number | null;
  activeSalePricingTiers?: ParkingPriceTier[] | null;
  activeSaleDurationUnit?: PricingDurationUnit | null;
  activeSaleDurationValue?: number | null;
  effectivePrice: number;
  effectivePriceLabel: string;
};

type OwnerPricingPopupProps = {
  isOpen: boolean;
  lots: OwnerPricingLot[];
  onClose: () => void;
  onSaved: (lotId: string, pricing: ParkingLotPricingPatch) => void;
};

type PricingFormState = {
  basePricingTiers: EditablePricingTier[];
  salePricingTiers: EditablePricingTier[];
  saleStartsAt: string;
  saleEndsAt: string;
};

let nextTierId = 0;

const durationUnitOptions: Array<{ value: PricingDurationUnit; label: string }> = [
  { value: "minutes", label: "דקות" },
  { value: "hours", label: "שעות" },
  { value: "day", label: "יום שלם" },
];

function normalizeDurationValue(unit: PricingDurationUnit, value: string | number | null | undefined) {
  if (unit === "day") {
    return "1";
  }

  const numericValue = typeof value === "number" ? value : Number(value ?? 1);
  return String(Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 1);
}

function createTierId() {
  nextTierId += 1;
  return `tier-${nextTierId}`;
}

function createEditableTier(tier?: Partial<ParkingPriceTier>): EditablePricingTier {
  const durationUnit = tier?.durationUnit ?? "hours";

  return {
    id: createTierId(),
    price: tier?.price ? String(tier.price) : "",
    durationUnit,
    durationValue: normalizeDurationValue(durationUnit, tier?.durationValue ?? 1),
  };
}

function toEditableTiers(tiers: ParkingPriceTier[], fallback?: Partial<ParkingPriceTier>) {
  if (tiers.length > 0) {
    return tiers.map((tier) => createEditableTier(tier));
  }

  return [createEditableTier(fallback)];
}

function toLocalDateTimeValue(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "";
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const offsetMs = parsedDate.getTimezoneOffset() * 60 * 1000;
  return new Date(parsedDate.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoOrNull(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function buildFormState(lot: OwnerPricingLot | null): PricingFormState {
  if (!lot) {
    return {
      basePricingTiers: [createEditableTier({ durationUnit: "hours", durationValue: 1 })],
      salePricingTiers: [createEditableTier({ durationUnit: "hours", durationValue: 1 })],
      saleStartsAt: "",
      saleEndsAt: "",
    };
  }

  return {
    basePricingTiers: toEditableTiers(getBasePricingTiers(lot), {
      price: lot.basePrice,
      durationUnit: lot.basePriceDurationUnit ?? "hours",
      durationValue: lot.basePriceDurationValue ?? 1,
    }),
    salePricingTiers: toEditableTiers(getSalePricingTiers(lot), {
      price: lot.salePrice ?? undefined,
      durationUnit: lot.salePriceDurationUnit ?? "hours",
      durationValue: lot.salePriceDurationValue ?? 1,
    }),
    saleStartsAt: toLocalDateTimeValue(lot.saleStartsAt),
    saleEndsAt: toLocalDateTimeValue(lot.saleEndsAt),
  };
}

function getPromotionStatus(lot: OwnerPricingLot | null) {
  if (!lot || (getSalePricingTiers(lot).length === 0 && getActiveSalePricingTiers(lot).length === 0)) {
    return "אין מבצע פעיל";
  }

  const now = new Date();
  const activeSalePrice = getActiveSalePrice(lot, now);
  if (typeof activeSalePrice === "number") {
    return "מבצע פעיל כרגע";
  }

  const startsAt = lot.saleStartsAt ? new Date(lot.saleStartsAt) : null;
  const endsAt = lot.saleEndsAt ? new Date(lot.saleEndsAt) : null;

  if (startsAt && startsAt.getTime() > now.getTime()) {
    return "מבצע מתוזמן לפרסום";
  }

  if (endsAt && endsAt.getTime() < now.getTime()) {
    return "מבצע הסתיים";
  }

  return "מבצע מוכן לפרסום";
}

async function loadOwnerPricingLot(lot: OwnerPricingLot) {
  const latestLot = await getParkingLot(lot.id);

  if (!latestLot) {
    return {
      ...lot,
      effectivePrice: getEffectiveLotPricing(lot).price,
      effectivePriceLabel: getEffectiveLotPricing(lot).label,
    } as OwnerPricingLot & ParkingLotDoc;
  }

  const mergedLot = {
    ...lot,
    ...latestLot,
    basePrice: latestLot.basePrice ?? lot.basePrice,
    basePricingTiers: latestLot.basePricingTiers ?? lot.basePricingTiers ?? [],
    salePrice: latestLot.salePrice ?? null,
    salePricingTiers: latestLot.salePricingTiers ?? lot.salePricingTiers ?? null,
    saleStartsAt: latestLot.saleStartsAt ?? null,
    saleEndsAt: latestLot.saleEndsAt ?? null,
    activeSalePrice: latestLot.activeSalePrice ?? null,
    activeSalePricingTiers: latestLot.activeSalePricingTiers ?? lot.activeSalePricingTiers ?? null,
    basePriceDurationUnit: latestLot.basePriceDurationUnit ?? lot.basePriceDurationUnit ?? "hours",
    basePriceDurationValue: latestLot.basePriceDurationValue ?? lot.basePriceDurationValue ?? 1,
    salePriceDurationUnit: latestLot.salePriceDurationUnit ?? lot.salePriceDurationUnit ?? "hours",
    salePriceDurationValue: latestLot.salePriceDurationValue ?? lot.salePriceDurationValue ?? 1,
    activeSaleDurationUnit: latestLot.activeSaleDurationUnit ?? null,
    activeSaleDurationValue: latestLot.activeSaleDurationValue ?? null,
  } as OwnerPricingLot & ParkingLotDoc;

  const effectivePricing = getEffectiveLotPricing(mergedLot);
  mergedLot.effectivePrice = effectivePricing.price;
  mergedLot.effectivePriceLabel = effectivePricing.label;
  return mergedLot;
}

export default function OwnerPricingPopup({ isOpen, lots, onClose, onSaved }: OwnerPricingPopupProps) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [selectedLotSnapshot, setSelectedLotSnapshot] = useState<(OwnerPricingLot & ParkingLotDoc) | null>(null);
  const [formState, setFormState] = useState<PricingFormState>(() => buildFormState(null));
  const [saving, setSaving] = useState(false);
  const [loadingLot, setLoadingLot] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedLotId((current) => {
      if (current && lots.some((lot) => lot.id === current)) {
        return current;
      }

      return lots[0]?.id ?? null;
    });
  }, [isOpen, lots]);

  const selectedLot = useMemo(() => lots.find((lot) => lot.id === selectedLotId) ?? null, [lots, selectedLotId]);

  useEffect(() => {
    if (!isOpen || !selectedLot) {
      setSelectedLotSnapshot(null);
      return;
    }

    let isDisposed = false;

    const loadSelectedLot = async () => {
      setLoadingLot(true);

      try {
        const latestLot = await loadOwnerPricingLot(selectedLot);

        if (isDisposed) {
          return;
        }

        setSelectedLotSnapshot(latestLot);
      } catch (loadError) {
        if (!isDisposed) {
          const message = loadError instanceof Error ? loadError.message : String(loadError);
          setError(message || "לא הצלחנו לטעון את מחירי החניון כרגע.");
          setSelectedLotSnapshot({
            ...selectedLot,
            effectivePrice: getEffectiveLotPricing(selectedLot).price,
            effectivePriceLabel: getEffectiveLotPricing(selectedLot).label,
          } as OwnerPricingLot & ParkingLotDoc);
        }
      } finally {
        if (!isDisposed) {
          setLoadingLot(false);
        }
      }
    };

    void loadSelectedLot();

    return () => {
      isDisposed = true;
    };
  }, [isOpen, selectedLot]);

  useEffect(() => {
    setFormState(buildFormState(selectedLotSnapshot ?? selectedLot));
    setError("");
    setSuccessMessage("");
  }, [selectedLotId, selectedLot, selectedLotSnapshot]);

  useEffect(() => {
    if (!isOpen) {
      setError("");
      setSuccessMessage("");
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const sourceLot = selectedLotSnapshot ?? selectedLot;
  const currentBasePreviewTiers = sourceLot ? getBasePricingTiers(sourceLot) : [];
  const currentSalePreviewTiers = sourceLot ? getActiveSalePricingTiers(sourceLot) : [];

  const handleFieldChange = (field: keyof Pick<PricingFormState, "saleStartsAt" | "saleEndsAt">, value: string) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleTierFieldChange = (priceType: "base" | "sale", tierId: string, field: keyof Omit<EditablePricingTier, "id">, value: string) => {
    setFormState((current) => {
      const key = priceType === "base" ? "basePricingTiers" : "salePricingTiers";

      return {
        ...current,
        [key]: current[key].map((tier) => {
          if (tier.id !== tierId) {
            return tier;
          }

          if (field === "durationUnit") {
            const nextUnit = value as PricingDurationUnit;
            return {
              ...tier,
              durationUnit: nextUnit,
              durationValue: normalizeDurationValue(nextUnit, tier.durationValue),
            };
          }

          return {
            ...tier,
            [field]: value,
          };
        }),
      };
    });
  };

  const handleAddTier = (priceType: "base" | "sale") => {
    setFormState((current) => {
      const key = priceType === "base" ? "basePricingTiers" : "salePricingTiers";
      const previousTier = current[key][current[key].length - 1];

      return {
        ...current,
        [key]: [
          ...current[key],
          createEditableTier({
            durationUnit: previousTier?.durationUnit ?? "hours",
            durationValue: previousTier ? Number(normalizeDurationValue(previousTier.durationUnit, previousTier.durationValue)) : 1,
          }),
        ],
      };
    });
  };

  const handleRemoveTier = (priceType: "base" | "sale", tierId: string) => {
    setFormState((current) => {
      const key = priceType === "base" ? "basePricingTiers" : "salePricingTiers";
      const nextTiers = current[key].filter((tier) => tier.id !== tierId);

      if (priceType === "base" && nextTiers.length === 0) {
        return {
          ...current,
          basePricingTiers: [createEditableTier({ durationUnit: "hours", durationValue: 1 })],
        };
      }

      return {
        ...current,
        [key]: nextTiers.length > 0 ? nextTiers : [createEditableTier({ durationUnit: "hours", durationValue: 1 })],
      };
    });
  };

  const buildPricingTiers = (tiers: EditablePricingTier[], label: string) => {
    const parsedTiers = tiers.map((tier) => ({
      price: Number(tier.price),
      durationUnit: tier.durationUnit,
      durationValue: Number(normalizeDurationValue(tier.durationUnit, tier.durationValue)),
    }));

    for (const tier of parsedTiers) {
      if (!Number.isFinite(tier.price) || tier.price <= 0) {
        throw new Error(`יש להזין ${label} חוקי וגדול מאפס לכל מדרגה.`);
      }
    }

    return parsedTiers;
  };

  const handleSave = async () => {
    if (!sourceLot) {
      return;
    }

    let nextBasePricingTiers: ParkingPriceTier[];
    let nextSalePricingTiers: ParkingPriceTier[];

    try {
      nextBasePricingTiers = buildPricingTiers(formState.basePricingTiers, "מחיר");
      nextSalePricingTiers = buildPricingTiers(
        formState.salePricingTiers.filter((tier) => tier.price.trim() !== ""),
        "מחיר מבצע"
      );
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "המחירים שהוזנו אינם תקינים.");
      return;
    }

    const nextSaleStartsAt = toIsoOrNull(formState.saleStartsAt);
    const nextSaleEndsAt = toIsoOrNull(formState.saleEndsAt);

    if (nextBasePricingTiers.length === 0) {
      setError("חייבת להיות לפחות מדרגת מחיר בסיס אחת.");
      return;
    }

    if (nextSalePricingTiers.length === 0 && (formState.saleStartsAt || formState.saleEndsAt)) {
      setError("אם הוגדרו תאריכי מבצע, צריך להגדיר לפחות מדרגת מבצע אחת.");
      return;
    }

    if (nextSaleStartsAt && nextSaleEndsAt && new Date(nextSaleEndsAt).getTime() <= new Date(nextSaleStartsAt).getTime()) {
      setError("סיום המבצע חייב להיות אחרי מועד ההתחלה.");
      return;
    }

    const pricingPatch: ParkingLotPricingPatch = {
      basePricingTiers: nextBasePricingTiers,
      salePricingTiers: nextSalePricingTiers.length > 0 ? nextSalePricingTiers : null,
      saleStartsAt: nextSalePricingTiers.length === 0 ? null : nextSaleStartsAt,
      saleEndsAt: nextSalePricingTiers.length === 0 ? null : nextSaleEndsAt,
    };

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await setLotPricing(selectedLot.id, pricingPatch);
      onSaved(selectedLot.id, pricingPatch);
      setSelectedLotSnapshot(await loadOwnerPricingLot(sourceLot));
      setSuccessMessage("המחירים והמבצע נשמרו בהצלחה.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(message || "לא הצלחנו לשמור את המחירים כרגע.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearPromotion = async () => {
    if (!sourceLot) {
      return;
    }

    const pricingPatch: ParkingLotPricingPatch = {
      basePricingTiers: buildPricingTiers(formState.basePricingTiers, "מחיר"),
      salePricingTiers: null,
      saleStartsAt: null,
      saleEndsAt: null,
    };

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await setLotPricing(selectedLot.id, pricingPatch);
      onSaved(selectedLot.id, pricingPatch);
      setSelectedLotSnapshot(await loadOwnerPricingLot(sourceLot));
      setFormState((current) => ({
        ...current,
        salePricingTiers: [createEditableTier({ durationUnit: "hours", durationValue: 1 })],
        saleStartsAt: "",
        saleEndsAt: "",
      }));
      setSuccessMessage("המבצע הוסר והמחיר הרגיל נשאר פעיל.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(message || "לא הצלחנו להסיר את המבצע כרגע.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="owner-pricing-popup__overlay" role="presentation" onClick={onClose}>
      <div className="owner-pricing-popup" role="dialog" aria-modal="true" aria-labelledby="owner-pricing-popup-title" onClick={(event) => event.stopPropagation()}>
        <div className="owner-pricing-popup__header">
          <div>
            <p className="owner-pricing-popup__eyebrow">Pricing & promotions</p>
            <h2 id="owner-pricing-popup-title">ניהול מחירים ומבצעים</h2>
            <p className="owner-pricing-popup__subtitle">בחר חניון, עדכן מדרגות מחיר לפי טווחי זמן, והגדר גם מדרגות מבצע באותם פרקי זמן.</p>
          </div>
          <button type="button" className="owner-pricing-popup__close" onClick={onClose} aria-label="סגירה">
            ✕
          </button>
        </div>

        <div className="owner-pricing-popup__body">
          <aside className="owner-pricing-popup__lots-panel">
            <h3>החניונים שלך</h3>
            <div className="owner-pricing-popup__lots-list">
              {lots.map((lot) => (
                <button
                  key={lot.id}
                  type="button"
                  className={`owner-pricing-popup__lot-button ${selectedLotId === lot.id ? "owner-pricing-popup__lot-button--active" : ""}`}
                  onClick={() => setSelectedLotId(lot.id)}
                >
                  <strong>{lot.name}</strong>
                  <span>{lot.address}</span>
                  <em>₪{lot.effectivePrice} {lot.effectivePriceLabel}</em>
                </button>
              ))}
            </div>
          </aside>

          <section className="owner-pricing-popup__editor">
            {selectedLot ? (
              <>
                <div className="owner-pricing-popup__summary-grid">
                  <article className="owner-pricing-popup__summary-card">
                    <span>מחיר פעיל</span>
                    <strong>{loadingLot ? "טוען..." : `החל מ־₪${sourceLot.effectivePrice}`}</strong>
                    <small>{loadingLot ? "" : sourceLot.effectivePriceLabel}</small>
                  </article>
                  <article className="owner-pricing-popup__summary-card">
                    <span>מדרגות בסיס</span>
                    <strong>{loadingLot ? "טוען..." : `${currentBasePreviewTiers.length} מדרגות`}</strong>
                    <small>{loadingLot || currentBasePreviewTiers.length === 0 ? "" : `ראשונה: ₪${currentBasePreviewTiers[0].price} ${getPricingTierLabel(currentBasePreviewTiers[0])}`}</small>
                  </article>
                  <article className="owner-pricing-popup__summary-card">
                    <span>סטטוס מבצע</span>
                    <strong>{loadingLot ? "טוען..." : getPromotionStatus(selectedLotSnapshot ?? selectedLot)}</strong>
                    <small>{loadingLot || currentSalePreviewTiers.length === 0 ? "" : `ראשונה: ₪${currentSalePreviewTiers[0].price} ${getPricingTierLabel(currentSalePreviewTiers[0])}`}</small>
                  </article>
                </div>

                <section className="owner-pricing-popup__tier-section">
                  <div className="owner-pricing-popup__tier-header">
                    <div>
                      <h3>מדרגות מחיר רגיל</h3>
                      <p>הגדר כמה עולה כל טווח זמן. המערכת תמיין את המדרגות מהטווח הקצר לארוך.</p>
                    </div>
                    <button type="button" className="owner-pricing-popup__secondary" onClick={() => handleAddTier("base")} disabled={saving}>
                      הוסף מדרגה
                    </button>
                  </div>

                  <div className="owner-pricing-popup__tier-list">
                    {formState.basePricingTiers.map((tier, index) => (
                      <div key={tier.id} className="owner-pricing-popup__tier-card">
                        <div className="owner-pricing-popup__tier-index">מדרגה {index + 1}</div>
                        <label className="owner-pricing-popup__field">
                          <span>מחיר</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={tier.price}
                            onChange={(event) => handleTierFieldChange("base", tier.id, "price", event.target.value)}
                          />
                        </label>
                        <div className="owner-pricing-popup__field owner-pricing-popup__field--duration">
                          <span>עד טווח זמן</span>
                          <div className="owner-pricing-popup__duration-row">
                            <select
                              value={tier.durationUnit}
                              onChange={(event) => handleTierFieldChange("base", tier.id, "durationUnit", event.target.value)}
                            >
                              {durationUnitOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={tier.durationValue}
                              onChange={(event) => handleTierFieldChange("base", tier.id, "durationValue", event.target.value)}
                              disabled={tier.durationUnit === "day"}
                            />
                          </div>
                        </div>
                        <div className="owner-pricing-popup__tier-footer">
                          <small>{tier.price ? `יוצג: ₪${tier.price} ${getPricingTierLabel({ durationUnit: tier.durationUnit, durationValue: Number(normalizeDurationValue(tier.durationUnit, tier.durationValue)) })}` : "השלם מחיר להצגה מקדימה"}</small>
                          <button type="button" className="owner-pricing-popup__ghost" onClick={() => handleRemoveTier("base", tier.id)} disabled={saving && formState.basePricingTiers.length === 1}>
                            הסר מדרגה
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="owner-pricing-popup__tier-section">
                  <div className="owner-pricing-popup__tier-header">
                    <div>
                      <h3>מדרגות מבצע</h3>
                      <p>אפשר להגדיר מבצע נפרד לכל טווח זמן. השאר את כל המחירים ריקים אם אין מבצע.</p>
                    </div>
                    <button type="button" className="owner-pricing-popup__secondary" onClick={() => handleAddTier("sale")} disabled={saving}>
                      הוסף מדרגת מבצע
                    </button>
                  </div>

                  <div className="owner-pricing-popup__tier-list">
                    {formState.salePricingTiers.map((tier, index) => (
                      <div key={tier.id} className="owner-pricing-popup__tier-card">
                        <div className="owner-pricing-popup__tier-index">מבצע {index + 1}</div>
                        <label className="owner-pricing-popup__field">
                          <span>מחיר מבצע</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={tier.price}
                            onChange={(event) => handleTierFieldChange("sale", tier.id, "price", event.target.value)}
                            placeholder="ריק = אין מדרגה"
                          />
                        </label>
                        <div className="owner-pricing-popup__field owner-pricing-popup__field--duration">
                          <span>עד טווח זמן</span>
                          <div className="owner-pricing-popup__duration-row">
                            <select
                              value={tier.durationUnit}
                              onChange={(event) => handleTierFieldChange("sale", tier.id, "durationUnit", event.target.value)}
                            >
                              {durationUnitOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={tier.durationValue}
                              onChange={(event) => handleTierFieldChange("sale", tier.id, "durationValue", event.target.value)}
                              disabled={tier.durationUnit === "day"}
                            />
                          </div>
                        </div>
                        <div className="owner-pricing-popup__tier-footer">
                          <small>{tier.price ? `יוצג: ₪${tier.price} ${getPricingTierLabel({ durationUnit: tier.durationUnit, durationValue: Number(normalizeDurationValue(tier.durationUnit, tier.durationValue)) })}` : "השאר ריק אם אין צורך במדרגה הזאת"}</small>
                          <button type="button" className="owner-pricing-popup__ghost" onClick={() => handleRemoveTier("sale", tier.id)} disabled={saving}>
                            הסר מדרגה
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="owner-pricing-popup__form-grid">
                    <label className="owner-pricing-popup__field">
                      <span>תחילת מבצע</span>
                      <input
                        type="datetime-local"
                        value={formState.saleStartsAt}
                        onChange={(event) => handleFieldChange("saleStartsAt", event.target.value)}
                      />
                    </label>

                    <label className="owner-pricing-popup__field">
                      <span>סיום מבצע</span>
                      <input
                        type="datetime-local"
                        value={formState.saleEndsAt}
                        onChange={(event) => handleFieldChange("saleEndsAt", event.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <div className="owner-pricing-popup__note">
                  <strong>איך זה עובד:</strong>
                  <span>כל שורה מייצגת מחיר עד טווח זמן מסוים. לדוגמה: עד 15 דקות, עד שעה, ועד יום שלם. אותו מבנה עובד גם על מבצעים.</span>
                </div>

                {error ? <p className="owner-pricing-popup__message owner-pricing-popup__message--error">{error}</p> : null}
                {successMessage ? <p className="owner-pricing-popup__message owner-pricing-popup__message--success">{successMessage}</p> : null}

                <div className="owner-pricing-popup__actions">
                  <button type="button" className="owner-pricing-popup__secondary" onClick={handleClearPromotion} disabled={saving}>
                    הסר מבצע
                  </button>
                  <button type="button" className="owner-pricing-popup__primary" onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "שומר..." : "שמור מחירים ופרסם מבצע"}
                  </button>
                </div>
              </>
            ) : (
              <p className="owner-pricing-popup__empty">לא נמצאו חניונים להצגה.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}