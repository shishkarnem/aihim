import { AlchemyElement, Rarity, ElementType, ElementState, WorldPhase } from "../types";
import { ELEMENT_TYPE_DETAILS, ESSENCE_DETAILS } from "../constants";

export async function generateNewElement(
  elementA: AlchemyElement,
  elementB: AlchemyElement,
  existingElements: AlchemyElement[],
  worldPhase: WorldPhase,
  discoveredLaws: any[] = [],
  currentLayer: any = null,
  availableLayers: any[] = [],
  spells: string[] = [],
  userId?: string,
  username?: string
): Promise<{ element: AlchemyElement | null, message?: string, isMutation?: boolean, isAlmostGuessed?: boolean }> {
  try {
    const res = await fetch("/api/generate-element", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        elementA,
        elementB,
        existingElements,
        worldPhase,
        discoveredLaws,
        currentLayer,
        availableLayers,
        ELEMENT_TYPE_DETAILS,
        ESSENCE_DETAILS,
        spells,
        userId,
        username
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned error: ${errText}`);
    }

    const data = await res.json();

    let extractedMessage: string | undefined = undefined;
    if (typeof data.message === 'string') {
      extractedMessage = data.message;
    } else if (data.message && typeof data.message === 'object') {
      extractedMessage = typeof data.message.message === 'string' 
        ? data.message.message 
        : JSON.stringify(data.message);
    }

    if (data.element && data.element.name) {
      return {
        element: {
          ...data.element,
          temperature: Math.round(data.element.temperature || 0),
          targetTemperature: Math.round(data.element.targetTemperature || 0),
          id: data.element.name.toLowerCase().replace(/\s+/g, '-'),
          parents: [elementA.id, elementB.id],
          discoveredAt: Date.now(),
          isMutation: !!data.isMutation,
        },
        message: extractedMessage,
        isMutation: !!data.isMutation,
        isAlmostGuessed: !!data.isAlmostGuessed,
      };
    }

    return {
      element: null,
      message: extractedMessage,
      isMutation: data.isMutation,
      isAlmostGuessed: data.isAlmostGuessed,
    };
  } catch (error) {
    console.error("Failed to generate element via ProTalk API proxy:", error);
    return {
      element: null,
      message: "Не удалось достучаться до эфирной сети. Возможно, истощился астральный канал. Нужно перезапустить астрал.",
      isAlmostGuessed: false,
      isMutation: false
    };
  }
}
