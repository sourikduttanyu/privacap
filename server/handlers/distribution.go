package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sourikduttanyu/privacap/server/store"
)

func GetDistribution(pg *store.PGStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		campaignID := chi.URLParam(r, "campaign_id")

		buckets, err := pg.GetDistribution(r.Context(), campaignID)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		if buckets == nil {
			buckets = []store.Bucket{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"campaign_id": campaignID,
			"buckets":     buckets,
		})
	}
}
