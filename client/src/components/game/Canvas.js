import React, { Component } from 'react';
import InputManager from './InputManager';
import TitleScreen from './TitleScreen';
import GameOverScreen from './GameOverScreen';
import ControlOverlay from './ControlOverlay';
import Ship from './Ship';
import Ship2 from './Ship2';
import Invader from './Invader';
import { checkCollisionsWith, checkCollision } from './Helper';
import {connect} from 'react-redux'
import {Redirect} from 'react-router-dom'
import {getGames, joinGame, updateGame} from '../../actions/games'
import {getUsers} from '../../actions/users'
import {userId} from '../../jwt'
const width = 800;
const height = window.innerHeight;
const GameState = {
   StartScreen : 0,
   Playing : 1,
   GameOver : 2
};
class Canvas extends Component {
  constructor() {
    super();
    this.state = {
      input: new InputManager(),
      screen: {
        width: width,
        height: height,
        ratio: window.devicePixelRatio || 1
      },
      score: 0,
      gameState: GameState.StartScreen,
      previousState: GameState.StartScreen,
      context: null
    };
    this.ship = null;
    this.ship2 = null;
    this.invaders = [];
    this.lastStateChange = 0;
    this.previousDelta = 0;
    this.fpsLimit = 30;
    this.showControls = false;
  }
  componentWillMount() {
    if (this.props.authenticated) {
      if (this.props.game === null) this.props.getGames()
      if (this.props.users === null) this.props.getUsers()
    }
  }

  joinGame = () => this.props.joinGame(this.props.game.id)
  
  handleResize(value, e){
    this.setState({
      screen : {
        width: width,
        height: height,
        ratio: window.devicePixelRatio || 1,
      }
    });
  }
  startGame() {
    let ship = new Ship({
      onDie: this.die.bind(this),
      position: {
        x: this.state.screen.width/2,
        y: this.state.screen.height - 50
      }});
    this.ship = ship;

    
    let ship2 = new Ship2({
      onDie: this.die.bind(this),
      position: {
        x: this.state.screen.width/3,
        y: this.state.screen.height - 50
      }});
    this.ship2 = ship2;
    this.createInvaders(27);
    this.setState({
      gameState: GameState.Playing,
      score: 0
    });
    this.showControls = true;
  }
  die() {
    this.setState({ gameState: GameState.GameOver });
    this.ship = null;
    this.ship2 = null;
    this.invaders = [];
    this.lastStateChange = Date.now();
  }
  increaseScore(val) {
    this.setState({ score: this.state.score + 500 });
  }
  update(currentDelta) {
    var delta = currentDelta - this.previousDelta;
    if (this.fpsLimit && delta < 1000 / this.fpsLimit) {
      return;
    }
    const keys = this.state.input.pressedKeys;
    const context = this.state.context;
    if (this.state.gameState === GameState.StartScreen && keys.enter && Date.now() - this.lastStateChange > 2000) {
      this.startGame();
    }
    if (this.state.gameState === GameState.GameOver && keys.enter) {
      this.setState({ gameState: GameState.StartScreen});
    }
    if (this.state.gameState === GameState.Playing && Date.now() - this.lastStateChange > 500) {
      if (this.state.previousState !== GameState.Playing) {
        this.lastStateChange = Date.now();
      }
      if (this.invaders.length === 0) {
        this.setState({ gameState: GameState.GameOver });
      }
      context.save();
      context.scale(this.state.screen.ratio, this.state.screen.ratio);
      context.fillRect(0, 0, this.state.screen.width, this.state.screen.height);
      context.globalAlpha = 1;
      checkCollisionsWith(this.ship.bullets, this.invaders);
      checkCollisionsWith(this.ship2.bullets, this.invaders);
      checkCollisionsWith([this.ship], this.invaders);
      checkCollisionsWith([this.ship2], this.invaders);
      if (keys.space || keys.left || keys.right) {
        this.showControls = false;
      }
      for (var i = 0; i < this.invaders.length; i++) {
        checkCollisionsWith(this.invaders[i].bullets, [this.ship,this.ship2])
      }
      if (this.ship !== null) {
        this.ship.update(keys);
        this.ship.render(this.state);
      }
      if (this.ship2 !== null) {
        this.ship2.update(keys);
        this.ship2.render(this.state);
      }
      this.renderInvaders(this.state);
      this.setState({previousState: this.state.gameState});
      context.restore();
    }
    requestAnimationFrame(() => {this.update()});
  }
  createInvaders(count) {
    const newPosition = { x: 100, y: 20 };
    let swapStartX = true;
    for (var i = 0; i < count; i++) {
      const invader = new Invader({
         position: { x: newPosition.x, y: newPosition.y },
         onDie: this.increaseScore.bind(this, false)
      });
      newPosition.x += invader.radius + 20;
      if (newPosition.x + invader.radius + 50 >= this.state.screen.width) {
        newPosition.x = swapStartX ? 110 : 100;
        swapStartX = !swapStartX;
        newPosition.y += invader.radius + 20;
      }
      this.invaders.push(invader);
    }
  }
  renderInvaders(state) {
    let index = 0;
    let reverse = false;
    for (let invader of this.invaders) {
      if (invader.delete) {
        this.invaders.splice(index, 1);
      }
      else if (invader.position.x + invader.radius >= this.state.screen.width ||
               invader.position.x - invader.radius <= 0) {
        reverse = true;
      }
      else {
        this.invaders[index].update();
        this.invaders[index].render(state);
      }
      index++;
    }
    if (reverse) {
      this.reverseInvaders();
    }
  }
  reverseInvaders() {
    let index = 0;
    for (let invader of this.invaders) {
      this.invaders[index].reverse();
      this.invaders[index].position.y += 50;
      index++;
    }
  }
  componentDidMount() {
    window.addEventListener('resize',  this.handleResize.bind(this, false));
    this.state.input.bindKeys();
    const context = this.refs.canvas.getContext('2d');
    this.setState({ context: context });
    requestAnimationFrame(() => {this.update()});
  }
  componentWillUnmount() {
    this.state.input.unbindKeys();
    window.removeEventListener('resize', this.handleResize);
  }
  render() {
    const {game, users, authenticated, userId} = this.props
    if (!authenticated) return (
            <Redirect to="/login" />
        )
    if (game === null || users === null) return 'Loading...'
    if (!game) return 'Not found'
    const player = game.players.find(p => p.userId === userId)
    return (
      <div>
        {
          game.status === 'pending' &&
          game.players.map(p => p.userId).indexOf(userId) === -1 &&
          <button onClick={this.joinGame}>Join Game</button>
        }
        { this.showControls && <ControlOverlay /> }
        { this.state.gameState === GameState.StartScreen && <TitleScreen /> }
        { this.state.gameState === GameState.GameOver && <GameOverScreen score= { this.state.score } /> }
        <canvas ref="canvas"
           width={ this.state.screen.width * this.state.screen.ratio }
           height={ this.state.screen.height * this.state.screen.ratio }
        />
      </div>
    );
  }
}
const mapStateToProps = (state, props) => ({
  authenticated: state.currentUser !== null,
  userId: state.currentUser && userId(state.currentUser.jwt),
  game: state.games && state.games[props.match.params.id],
  users: state.users
})
const mapDispatchToProps = {
  getGames, getUsers, joinGame, updateGame
}
export default connect(mapStateToProps, mapDispatchToProps)(Canvas)
// export default Canvas;