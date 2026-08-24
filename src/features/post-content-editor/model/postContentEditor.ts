export type PendingPostContentImage = {
  file: File;
  id: string;
};

export type PostThumbnailReference =
  | {
      kind: "content-upload";
      uploadId: string;
    }
  | {
      kind: "file-upload";
      uploadId: string;
    }
  | {
      kind: "stored";
      storagePath: string;
    }
  | null;

export type PostThumbnailCandidate = {
  key: string;
  label: string;
  previewUrl: string;
  reference: Exclude<PostThumbnailReference, null>;
};

export type PostContentEditorState = {
  content: string;
  pendingImages: PendingPostContentImage[];
  thumbnail: PostThumbnailReference;
};
