import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface FiltersState {
  type: "news" | "blogs" | "all";
  searchTerm: string;
  selectedAuthor: string;
  startDate: string;
  endDate: string;
}

const initialState: FiltersState = {
  type: "news",
  searchTerm: "",
  selectedAuthor: "All",
  startDate: "",
  endDate: "",
};

const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    setType(state, action: PayloadAction<"news" | "blogs" | "all">) {
      state.type = action.payload;
      state.selectedAuthor = "All";
      state.searchTerm = "";
      state.startDate = "";
      state.endDate = "";
    },
    setSearchTerm(state, action: PayloadAction<string>) {
      state.searchTerm = action.payload;
    },
    setSelectedAuthor(state, action: PayloadAction<string>) {
      state.selectedAuthor = action.payload;
    },
    setStartDate(state, action: PayloadAction<string>) {
      state.startDate = action.payload;
    },
    setEndDate(state, action: PayloadAction<string>) {
      state.endDate = action.payload;
    },
    resetFilters(state) {
      state.selectedAuthor = "All";
      state.searchTerm = "";
      state.startDate = "";
      state.endDate = "";
    },
  },
});

export const {
  setType,
  setSearchTerm,
  setSelectedAuthor,
  setStartDate,
  setEndDate,
  resetFilters,
} = filtersSlice.actions;

export default filtersSlice.reducer;
