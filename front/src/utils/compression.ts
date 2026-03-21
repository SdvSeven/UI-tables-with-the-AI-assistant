export const compressData = (data: any) => {
  return JSON.stringify(data);
};

export const decompressData = (compressed: string) => {
  return JSON.parse(compressed);
};