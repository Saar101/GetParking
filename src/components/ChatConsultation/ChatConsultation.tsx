import { useEffect, useMemo, useRef, useState } from "react";
import {
  requestParkingRecommendation,
  requestParkingFollowup,
  type ParkingRecommendationLot,
  type ParkingRecommendationResult,
  type ParkingFollowupMessage,
} from "../../services/openaiParking.service";
import "./ChatConsultation.css";

type MapCenter = {
  lat: number;
  lng: number;
} | null;

interface ChatConsultationProps {
  parkingLots: ParkingRecommendationLot[];
  mapCenter: MapCenter;
  radiusMeters: number;
  selectedLotId?: string | null;
  onSelectRecommendedLot?: (lotId: string) => void;
}

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
  kind?: "intro" | "recommendation" | "followup" | "error";
  source?: "openai" | "local";
};

export default function ChatConsultation({
  parkingLots,
  mapCenter,
  radiusMeters,
  selectedLotId,
  onSelectRecommendedLot,
}: ChatConsultationProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowupLoading, setIsFollowupLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ParkingRecommendationResult | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [showRankingBubble, setShowRankingBubble] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      kind: "intro",
      content: "שלום, אני בודק עכשיו את החניונים שקרובים אליך ומכין המלצה נעימה וקצרה.",
    },
    {
      role: "user",
      kind: "followup",
      content: "תמליץ לי על החניון הכי משתלם לפי מרחק, מחיר והמלצות.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const conversationMessages = useMemo(() => {
    if (result?.source === "local") {
      return chatMessages.filter((message) => message.kind !== "recommendation");
    }

    return chatMessages;
  }, [chatMessages, result?.source]);

  const recommendedLot = useMemo(() => {
    if (!result?.recommendedLotId) {
      return null;
    }

    return parkingLots.find((lot) => lot.id === result.recommendedLotId) ?? null;
  }, [parkingLots, result?.recommendedLotId]);

  const displayedLots = useMemo(
    () => (result?.rankedLots ?? parkingLots).slice(0, 5),
    [parkingLots, result?.rankedLots]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, isLoading, isFollowupLoading, result]);

  useEffect(() => {
    if (!result) {
      return;
    }

    setShowRankingBubble(true);
    setChatInput("");
  }, [recommendedLot, result]);

  const handleConsultation = async () => {
    if (parkingLots.length === 0 || isLoading) {
      return;
    }

    setIsPanelOpen(true);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await requestParkingRecommendation({
        mapCenter,
        radiusMeters,
        selectedLotId: selectedLotId ?? null,
        parkingLotsInRadius: parkingLots,
      });
      setResult(response);
      setShowRankingBubble(true);
    } catch (error: any) {
      setErrorMessage(error?.message ?? "לא הצלחנו לקבל המלצה כרגע");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickRecommended = () => {
    if (!result?.recommendedLotId || !onSelectRecommendedLot) {
      return;
    }

    onSelectRecommendedLot(result.recommendedLotId);
    setIsPanelOpen(false);
  };

  const canContinueConversation = result?.source === "openai";

  const handleSendFollowup = async () => {
    const question = chatInput.trim();

    if (!question || !result || !canContinueConversation || isFollowupLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      kind: "followup",
      content: question,
    };

    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsFollowupLoading(true);
    setShowRankingBubble(false);

    try {
      const messages = nextMessages
        .filter((message) => message.role === "assistant" || message.role === "user")
        .map((message) => ({
          role: message.role,
          content: message.content,
        })) as ParkingFollowupMessage[];

      const followup = await requestParkingFollowup({
        source: result.source,
        selectedLotId: result.recommendedLotId ?? null,
        mapCenter,
        radiusMeters,
        parkingLotsInRadius: parkingLots,
        messages,
      });

      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          kind: followup.source === "openai" ? "followup" : "error",
          source: followup.source,
          content: followup.reply,
        },
      ]);
    } catch (error: any) {
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          kind: "error",
          content: error?.message ?? "לא הצלחתי לענות כרגע",
        },
      ]);
    } finally {
      setIsFollowupLoading(false);
    }
  };

  return (
    <>
      <button
        className="chat-consultation-button"
        onClick={handleConsultation}
        disabled={parkingLots.length === 0 || isLoading}
        type="button"
      >
        <span className="chat-consultation-button__icon">😄</span>
        <span className="chat-consultation-button__text">
          <span className="chat-consultation-button__title">עזרה של AI</span>
          <span className="chat-consultation-button__subtitle">
            {parkingLots.length > 0 ? `${parkingLots.length} חניונים` : "אין נתונים"}
          </span>
        </span>
      </button>

      {isPanelOpen && (
        <div className="chat-consultation-panel-overlay" onClick={() => setIsPanelOpen(false)}>
          <div
            className="chat-consultation-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="chat-consultation-panel__header">
              <div>
                <h3 className="chat-consultation-panel__title">ייעוץ חכם לחניון</h3>
                <p className="chat-consultation-panel__subtitle">
                  המערכת משווה בין מרחק, מחיר, הנחה והמלצות, ומחזירה לך את הבחירה המשתלמת ביותר.
                </p>
              </div>
              <button
                className="chat-consultation-panel__close"
                onClick={() => setIsPanelOpen(false)}
                type="button"
                aria-label="סגירת הפאנל"
              >
                ✕
              </button>
            </div>

            <div className="chat-consultation-panel__body">
              <div className="chat-consultation-thread" role="log" aria-live="polite" aria-relevant="additions text">
                {conversationMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                    className={`chat-consultation-message chat-consultation-message--${message.role}`}
                  >
                    {message.role === "assistant" ? (
                      <div className="chat-consultation-message__avatar">
                        {message.kind === "recommendation" ? "📋" : message.kind === "error" ? "⚠️" : "🤖"}
                      </div>
                    ) : null}

                    <div
                      className={`chat-consultation-message__bubble ${message.role === "user" ? "chat-consultation-message__bubble--user" : ""} ${message.kind === "error" ? "chat-consultation-message__bubble--error" : ""}`}
                      style={{
                        ["--chat-bubble-delay" as string]: `${Math.min(index * 85, 340)}ms`,
                      }}
                    >
                      {message.kind === "recommendation" ? (
                        <>
                          <div className="chat-consultation-message__title">
                              {message.source === "openai" ? "ההמלצה הגיעה מ־OpenAI" : "ההמלצה חושבה מקומית"}
                          </div>
                          <div className="chat-consultation-message__recommendation">
                            {recommendedLot ? recommendedLot.name : result?.recommendedLotId ?? "לא נמצא"}
                          </div>
                          <div className="chat-consultation-message__explanation">{message.content}</div>
                        </>
                      ) : (
                        <div>{message.content}</div>
                      )}
                    </div>

                    {message.role === "user" ? (
                      <div className="chat-consultation-message__avatar chat-consultation-message__avatar--user">🙂</div>
                    ) : null}
                  </div>
                ))}

                {isLoading && (
                  <div className="chat-consultation-message chat-consultation-message--assistant">
                    <div className="chat-consultation-message__avatar">🤖</div>
                    <div className="chat-consultation-message__bubble chat-consultation-message__bubble--typing">
                      <span className="chat-consultation-typing">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                      <span>אני חושב על זה...</span>
                    </div>
                  </div>
                )}

                {isFollowupLoading && (
                  <div className="chat-consultation-message chat-consultation-message--assistant">
                    <div className="chat-consultation-message__avatar">🤖</div>
                    <div className="chat-consultation-message__bubble chat-consultation-message__bubble--typing">
                      <span className="chat-consultation-typing">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                      <span>עונה לך...</span>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="chat-consultation-message chat-consultation-message--assistant">
                    <div className="chat-consultation-message__avatar">⚠️</div>
                    <div className="chat-consultation-message__bubble chat-consultation-message__bubble--error">
                      {errorMessage}
                    </div>
                  </div>
                )}

                {!isLoading && !errorMessage && result && showRankingBubble && (
                  <>
                    <div className="chat-consultation-message chat-consultation-message--assistant">
                      <div className="chat-consultation-message__avatar">📋</div>
                      <div className="chat-consultation-message__bubble chat-consultation-message__bubble--compact">
                        <div className="chat-consultation-panel__list-title">גם הדירוג המלא:</div>
                        <div className="chat-consultation-panel__list">
                          {displayedLots.map((lot, index) => {
                            const scoredLot = lot as ParkingRecommendationLot & { score?: number };
                            const scoreText = typeof scoredLot.score === "number" ? scoredLot.score.toFixed(1) : "-";

                            return (
                              <div
                                key={lot.id}
                                className={`chat-consultation-panel__item ${lot.id === result.recommendedLotId ? "chat-consultation-panel__item--recommended" : ""}`}
                              >
                                <div className="chat-consultation-panel__item-title">
                                  <span>{index + 1}. {lot.name}</span>
                                  <span className="chat-consultation-panel__badge">ציון {scoreText}</span>
                                </div>
                                <div className="chat-consultation-panel__item-meta">
                                  <span>מרחק: {Math.round(lot.distanceMeters)} מ'</span>
                                  <span>מחיר: ₪{lot.price}/שעה</span>
                                  <span>הנחה: {lot.salePrice !== null ? `₪${lot.salePrice}` : "אין"}</span>
                                  <span>המלצות: {lot.recommendationCount}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="chat-consultation-panel__actions">
                      <button
                        className="chat-consultation-panel__action chat-consultation-panel__action--primary"
                        onClick={handlePickRecommended}
                        disabled={!result.recommendedLotId || !onSelectRecommendedLot}
                        type="button"
                      >
                        פתח את החניון המומלץ
                      </button>
                      <button
                        className="chat-consultation-panel__action chat-consultation-panel__action--secondary"
                        onClick={handleConsultation}
                        type="button"
                      >
                        נסה שוב
                      </button>
                    </div>
                  </>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="chat-consultation-panel__composer">
                <input
                  className="chat-consultation-panel__input"
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSendFollowup();
                    }
                  }}
                  disabled={!canContinueConversation || isFollowupLoading || !result}
                  placeholder={canContinueConversation ? "שאל אותי למה החניון הזה נבחר..." : "שאלות המשך זמינות רק אחרי המלצה מ־OpenAI"}
                />
                <button
                  className="chat-consultation-panel__action chat-consultation-panel__action--primary"
                  onClick={() => void handleSendFollowup()}
                  disabled={!canContinueConversation || isFollowupLoading || !chatInput.trim()}
                  type="button"
                >
                  שלח
                </button>
              </div>

              <div className="chat-consultation-panel__footer">
                {result?.source === "openai"
                  ? "התשובה הראשונית הגיעה מ־OpenAI, ולכן אפשר להמשיך לשאול שאלות המשך כאן."
                  : "כרגע התקבלה תשובה מקומית בלבד, ולכן שאלות המשך אינן זמינות עד שהתשובה תגיע מ־OpenAI."}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
