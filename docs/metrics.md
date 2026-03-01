# Metrics Specification

## 1) Win Rate

??:
- `win_rate(player_i) = player_i_wins / total_matches`

## 2) Draw Rate

??:
- `draw_rate = draws / total_matches`

## 3) Average Turns

??:
- `average_turns = sum(match_turn_count) / total_matches`

## 4) Action Distribution

??:
- `action_distribution[action_type] = action_count[action_type] / total_actions`

## 5) First-Player Advantage(??)

??:
- `first_player_advantage = win_rate(player_0) - mean(win_rate(other_players))`

??:
- ???????????

## 6) Strategy Concentration(??)

??(??):
- ?? action distribution ?????(?? Herfindahl-Hirschman Index)?
- `concentration = sum(p_action^2)`

??:
- ???????????

## 7) Future Fairness Objectives(?)

- ?? A:`abs(first_player_advantage) <= 0.05`
- ?? B:`average_turns` ???????(?? 6~12)
- ?? C:`strategy_concentration <= threshold`

????? Milestone 4 ??????
