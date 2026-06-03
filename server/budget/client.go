package budget

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}
}

type consumeRequest struct {
	CohortID    string  `json:"cohort_id"`
	CampaignID  string  `json:"campaign_id"`
	EpsilonCost float64 `json:"epsilon_cost"`
}

type consumeResponse struct {
	Allowed   bool    `json:"allowed"`
	Remaining float64 `json:"remaining"`
}

// CheckAndConsume calls budget-manager POST /budget/consume.
// Returns (false, nil) on 429 — budget exhausted, not a system error.
// Returns (false, err) on any other failure — treat as system error, fail closed.
func (c *Client) CheckAndConsume(ctx context.Context, cohortID, campaignID string, epsilonCost float64) (bool, error) {
	body, _ := json.Marshal(consumeRequest{
		CohortID:    cohortID,
		CampaignID:  campaignID,
		EpsilonCost: epsilonCost,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/budget/consume", bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("budget-manager unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return false, nil
	}
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("budget-manager returned %d", resp.StatusCode)
	}

	var cr consumeResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return false, err
	}
	return cr.Allowed, nil
}

// GetRemaining calls budget-manager GET /budget/{cohortID}.
func (c *Client) GetRemaining(ctx context.Context, cohortID string) (float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/budget/%s", c.baseURL, cohortID), nil)
	if err != nil {
		return 0, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var rows []struct {
		Remaining float64 `json:"remaining"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Remaining, nil
}
