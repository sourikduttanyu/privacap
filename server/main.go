package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kelseyhightower/envconfig"
	"github.com/sourikduttanyu/privacap/server/budget"
	"github.com/sourikduttanyu/privacap/server/handlers"
	"github.com/sourikduttanyu/privacap/server/store"
)

type Config struct {
	DatabaseURL           string `envconfig:"DATABASE_URL" required:"true"`
	RedisURL              string `envconfig:"REDIS_URL" default:"localhost:6379"`
	BudgetManagerURL      string `envconfig:"BUDGET_MANAGER_URL" default:"http://localhost:8081"`
	Port                  string `envconfig:"PORT" default:"8080"`
	FrequencyCap          int    `envconfig:"FREQUENCY_CAP" default:"5"`
	CampaignWindowSeconds int    `envconfig:"CAMPAIGN_WINDOW_SECONDS" default:"86400"`
	DPEpsilon             float64 `envconfig:"DP_EPSILON" default:"1.0"`
}

func main() {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	rs := store.NewRedis(cfg.RedisURL)
	if err := rs.Ping(ctx); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	pg := store.NewPG(db)
	bc := budget.NewClient(cfg.BudgetManagerURL)
	windowTTL := time.Duration(cfg.CampaignWindowSeconds) * time.Second

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Post("/impressions", handlers.Impressions(rs, pg, bc, cfg.FrequencyCap, windowTTL, cfg.DPEpsilon))
	r.Get("/caps/{cohort_id}/{campaign_id}", handlers.GetCaps(rs, bc, cfg.FrequencyCap))
	r.Get("/distribution/{campaign_id}", handlers.GetDistribution(pg))

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}

	go func() {
		log.Printf("cap-service listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(shutCtx)
}
