import React from 'react';
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import InputLabel from '@material-ui/core/InputLabel';

export default class EstimationSelect extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            estimationList: [],
            estimationId: ""
        };
    }
    selectedId=()=>{
      return this.state.estimationId;
    };

    componentDidMount = async () => {
        const estimationList = [{name: 'Face', value: 'Face'},{name: 'Hand', value: 'Hand'},{name: 'Pose', value: 'Pose'}, {name: 'Full Body', value: 'Full Body'}]
        this.setState({
            estimationList: estimationList
        })
    };

    onChangeHandler=(event)=>{
        this.setState({
            estimationId: event.target.value
        })
    };
    render() {
        const {estimationList, estimationId} = this.state;
        const items = estimationList.map((d, i) =>
            <MenuItem key={i} value={d.name}>{d.value}</MenuItem>
        );
        return (
            <div>
            <InputLabel id="estimation-label">Select estimation type</InputLabel>
        <Select value={estimationId} onChange={this.onChangeHandler} style={{minWidth: 280}}>
            {items}
        </Select>
        </div>);
    }
}
