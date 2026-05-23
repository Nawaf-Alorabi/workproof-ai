export const getAiInsight = (notes: string): string => {
    if (notes.length < 20) {
        return "نصيحة: الملاحظات قصيرة، يرجى إضافة تفاصيل أكثر.";
    }
    return "تحليل: الملاحظات ممتازة ومفصلة.";
};