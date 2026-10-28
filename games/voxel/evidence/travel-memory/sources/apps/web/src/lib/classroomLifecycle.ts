interface ClassroomMaterialPublicationState {
  canPresent: boolean;
  visible: boolean;
  isPublished: boolean;
  isPreparing: boolean;
  selectedMaterialId: string | null;
  preparedMaterialId: string | null;
}

export function shouldPublishClassroomMaterial(state: ClassroomMaterialPublicationState): boolean {
  return Boolean(
    state.canPresent &&
    state.visible &&
    !state.isPublished &&
    !state.isPreparing &&
    state.selectedMaterialId &&
    state.preparedMaterialId === state.selectedMaterialId
  );
}
